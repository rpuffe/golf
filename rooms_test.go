package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func roomServer(t *testing.T) (*httptest.Server, *Rooms) {
	t.Helper()
	rs := &Rooms{rooms: map[string]*Room{}} // no janitor goroutine in tests
	mux := http.NewServeMux()
	rs.register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, rs
}

func postJSON(t *testing.T, url string, body any) (*http.Response, []byte) {
	t.Helper()
	b, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	buf.ReadFrom(resp.Body)
	return resp, buf.Bytes()
}

type sseEvent struct{ name, data string }

// openStream reads SSE events into a channel until the test ends.
func openStream(t *testing.T, url string) <-chan sseEvent {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("stream status %d", resp.StatusCode)
	}
	out := make(chan sseEvent, 32)
	go func() {
		defer resp.Body.Close()
		sc := bufio.NewScanner(resp.Body)
		sc.Buffer(make([]byte, 1<<20), 1<<20)
		var ev sseEvent
		for sc.Scan() {
			line := sc.Text()
			switch {
			case strings.HasPrefix(line, "event: "):
				ev.name = line[7:]
			case strings.HasPrefix(line, "data: "):
				ev.data = line[6:]
			case line == "" && ev.name != "":
				out <- ev
				ev = sseEvent{}
			}
		}
	}()
	return out
}

func waitEvent(t *testing.T, ch <-chan sseEvent, name string) sseEvent {
	t.Helper()
	deadline := time.After(2 * time.Second)
	for {
		select {
		case ev := <-ch:
			if ev.name == name {
				return ev
			}
		case <-deadline:
			t.Fatalf("no %q event", name)
		}
	}
}

func TestRoomFlow(t *testing.T) {
	srv, _ := roomServer(t)
	resp, body := postJSON(t, srv.URL+"/api/rooms", map[string]string{"name": "Ada"})
	if resp.StatusCode != 200 {
		t.Fatalf("create: %d %s", resp.StatusCode, body)
	}
	var host joinResp
	json.Unmarshal(body, &host)
	if len(host.Code) != 4 || host.HostID != host.You {
		t.Fatalf("bad create response %+v", host)
	}
	resp, body = postJSON(t, srv.URL+"/api/rooms/"+strings.ToLower(host.Code)+"/join", map[string]string{"name": "Bo"})
	if resp.StatusCode != 200 {
		t.Fatalf("join: %d %s", resp.StatusCode, body)
	}
	var guest joinResp
	json.Unmarshal(body, &guest)
	if len(guest.Members) != 2 || guest.Members[1].Color == guest.Members[0].Color {
		t.Fatalf("bad roster %+v", guest.Members)
	}

	hostStream := openStream(t, srv.URL+"/api/rooms/"+host.Code+"/events?id="+host.You+"&token="+host.Token)
	waitEvent(t, hostStream, "roster")
	guestStream := openStream(t, srv.URL+"/api/rooms/"+host.Code+"/events?id="+guest.You+"&token="+guest.Token)
	snap := waitEvent(t, guestStream, "roster")
	if !strings.Contains(snap.data, `"online":true`) {
		t.Fatalf("snapshot missing online member: %s", snap.data)
	}

	send := func(who joinResp, m map[string]any) int {
		m["id"], m["token"] = who.You, who.Token
		r, _ := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/send", m)
		return r.StatusCode
	}
	if c := send(guest, map[string]any{"seq": 1, "type": "start"}); c != http.StatusForbidden {
		t.Fatalf("guest start: %d", c)
	}
	if c := send(host, map[string]any{"seq": 1, "type": "start"}); c != 200 {
		t.Fatalf("host start: %d", c)
	}
	waitEvent(t, guestStream, "start")

	shot := map[string]any{"seq": 2, "type": "shot", "round": 1, "hole": 1, "stroke": 1, "start": map[string]float64{"x": 1, "y": 2, "z": 3},
		"res": "rest", "club": "driver", "f": []int{100, 200, 300, 400, 500, 600}, "progress": map[string]any{"hole": 1, "strokes": 1, "rest": map[string]float64{"x": 4, "y": 5, "z": 6}}}
	if c := send(host, shot); c != http.StatusNoContent {
		t.Fatalf("shot: %d", c)
	}
	ev := waitEvent(t, guestStream, "shot")
	var se shotEvent
	json.Unmarshal([]byte(ev.data), &se)
	if se.From != host.You || len(se.F) != 6 || se.Progress.Rest.X != 4 {
		t.Fatalf("bad relayed shot %+v", se)
	}
	// a retry of the same seq is accepted but not relayed again
	if c := send(host, shot); c != http.StatusNoContent {
		t.Fatalf("retry: %d", c)
	}
	shot["seq"], shot["round"] = 3, 7
	if c := send(host, shot); c != http.StatusConflict {
		t.Fatalf("stale round: %d", c)
	}
	shot["round"], shot["f"] = 1, []int{1, 2}
	if c := send(host, shot); c != http.StatusBadRequest {
		t.Fatalf("ragged frames: %d", c)
	}
	// reconnect snapshot carries the host's rest position
	_, body = postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "Bo", "id": guest.You, "token": guest.Token})
	var re joinResp
	json.Unmarshal(body, &re)
	if re.You != guest.You || len(re.Members) != 2 || re.Members[0].Progress.Rest == nil {
		t.Fatalf("rejoin lost state %+v", re)
	}
	select {
	case ev := <-guestStream:
		if ev.name == "shot" {
			t.Fatal("retried shot was relayed twice")
		}
	default:
	}
}

func TestRoomLimitsAndHandOff(t *testing.T) {
	srv, rs := roomServer(t)
	_, body := postJSON(t, srv.URL+"/api/rooms", map[string]string{"name": "Host"})
	var host joinResp
	json.Unmarshal(body, &host)
	var last joinResp
	for i := 1; i < maxRoomMembers; i++ {
		resp, b := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "P"})
		if resp.StatusCode != 200 {
			t.Fatalf("join %d: %d", i, resp.StatusCode)
		}
		json.Unmarshal(b, &last)
	}
	if resp, _ := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "Late"}); resp.StatusCode != http.StatusConflict {
		t.Fatalf("full room: %d", resp.StatusCode)
	}
	if resp, _ := postJSON(t, srv.URL+"/api/rooms/ZZZZ/join", map[string]string{"name": "X"}); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing room: %d", resp.StatusCode)
	}
	postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/send", map[string]any{"id": host.You, "token": host.Token, "seq": 1, "type": "leave"})
	r := rs.get(host.Code)
	r.mu.Lock()
	newHost := r.hostID
	n := len(r.members)
	r.mu.Unlock()
	if newHost == "" || newHost == host.You || n != maxRoomMembers-1 {
		t.Fatalf("host hand-off failed: host=%q members=%d", newHost, n)
	}
	// an idle room is swept
	r.mu.Lock()
	r.lastActive = time.Now().Add(-2 * roomIdleTimeout)
	r.mu.Unlock()
	rs.sweep(time.Now())
	if len(rs.sortedCodes()) != 0 {
		t.Fatal("idle room was not swept")
	}
	_ = last
}
