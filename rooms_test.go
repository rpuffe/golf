package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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
		resp, b := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "P" + string(rune('0'+i))})
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

// fakeEmoteClock pins the emote bucket's clock for the rest of the test and
// returns a function that moves it forward.
func fakeEmoteClock(t *testing.T) (advance func(time.Duration)) {
	t.Helper()
	var mu sync.Mutex
	now := time.Unix(1_700_000_000, 0)
	prev := emoteClock
	emoteClock = func() time.Time {
		mu.Lock()
		defer mu.Unlock()
		return now
	}
	t.Cleanup(func() { emoteClock = prev })
	return func(d time.Duration) {
		mu.Lock()
		now = now.Add(d)
		mu.Unlock()
	}
}

// noEvent fails if an event with this name arrives within a short window.
func noEvent(t *testing.T, ch <-chan sseEvent, name string) {
	t.Helper()
	deadline := time.After(150 * time.Millisecond)
	for {
		select {
		case ev := <-ch:
			if ev.name == name {
				t.Fatalf("unexpected %q event: %s", name, ev.data)
			}
		case <-deadline:
			return
		}
	}
}

func TestRoomEmotes(t *testing.T) {
	advance := fakeEmoteClock(t)
	srv, _ := roomServer(t)
	_, body := postJSON(t, srv.URL+"/api/rooms", map[string]string{"name": "Ada"})
	var ada joinResp
	json.Unmarshal(body, &ada)
	join := func(name string) joinResp {
		_, b := postJSON(t, srv.URL+"/api/rooms/"+ada.Code+"/join", map[string]string{"name": name})
		var j joinResp
		json.Unmarshal(b, &j)
		return j
	}
	bo, cy := join("Bo"), join("Cy")
	stream := func(who joinResp) <-chan sseEvent {
		s := openStream(t, srv.URL+"/api/rooms/"+ada.Code+"/events?id="+who.You+"&token="+who.Token)
		waitEvent(t, s, "roster")
		return s
	}
	adaStream, boStream, cyStream := stream(ada), stream(bo), stream(cy)

	seq := 0
	send := func(who joinResp, m map[string]any) int {
		m["id"], m["token"], m["type"] = who.You, who.Token, "emote"
		if _, ok := m["seq"]; !ok {
			seq++
			m["seq"] = seq
		}
		r, _ := postJSON(t, srv.URL+"/api/rooms/"+ada.Code+"/send", m)
		return r.StatusCode
	}
	decode := func(ev sseEvent) emoteEvent {
		var e emoteEvent
		json.Unmarshal([]byte(ev.data), &e)
		return e
	}

	// broadcast to everyone but the sender; lobby emotes are fine (round 0 ≠ room.round)
	if c := send(ada, map[string]any{"kind": "honk", "arg": "  hi\x07 there\n", "round": 0}); c != http.StatusNoContent {
		t.Fatalf("emote: %d", c)
	}
	if e := decode(waitEvent(t, boStream, "emote")); e.From != ada.You || e.Kind != "honk" || e.To != "" || e.Arg != "hi there" || e.Round != 0 {
		t.Fatalf("bad relayed emote %+v", e)
	}
	waitEvent(t, cyStream, "emote")
	noEvent(t, adaStream, "emote")

	// targeted: still everyone but the sender, round passed through
	if c := send(ada, map[string]any{"kind": "power_up-2", "to": bo.You, "round": 7}); c != http.StatusNoContent {
		t.Fatalf("targeted emote: %d", c)
	}
	if e := decode(waitEvent(t, cyStream, "emote")); e.To != bo.You || e.Kind != "power_up-2" || e.Round != 7 {
		t.Fatalf("bad targeted emote %+v", e)
	}
	if e := decode(waitEvent(t, boStream, "emote")); e.To != bo.You {
		t.Fatalf("target missed its emote %+v", e)
	}
	noEvent(t, adaStream, "emote")

	// validation
	for name, m := range map[string]map[string]any{
		"empty kind":     {"kind": ""},
		"upper kind":     {"kind": "Honk"},
		"spaced kind":    {"kind": "big honk"},
		"long kind":      {"kind": strings.Repeat("a", maxEmoteKind+1)},
		"unknown target": {"kind": "honk", "to": "nobody"},
		"self target":    {"kind": "honk", "to": ada.You},
		"long arg":       {"kind": "honk", "arg": strings.Repeat("é", maxEmoteArg/2+1)},
	} {
		if c := send(ada, m); c != http.StatusBadRequest {
			t.Fatalf("%s: %d", name, c)
		}
	}
	// control characters don't count against the limit
	if c := send(ada, map[string]any{"kind": "honk", "arg": strings.Repeat("a", maxEmoteArg) + "\x00\x01"}); c != http.StatusNoContent {
		t.Fatalf("arg at limit: %d", c)
	}
	waitEvent(t, boStream, "emote")
	// seq dedup: a retry is accepted, not relayed, and costs no token
	if c := send(bo, map[string]any{"kind": "honk"}); c != http.StatusNoContent {
		t.Fatalf("bo emote: %d", c)
	}
	waitEvent(t, adaStream, "emote")
	dup := map[string]any{"kind": "honk", "seq": seq}
	for i := 0; i < 2*emoteBurst; i++ {
		if c := send(bo, dup); c != http.StatusNoContent {
			t.Fatalf("retry %d: %d", i, c)
		}
	}
	noEvent(t, adaStream, "emote")

	// rate limit: Bo has burst-1 tokens left (the retries cost nothing)
	for i := 1; i < emoteBurst; i++ {
		if c := send(bo, map[string]any{"kind": "honk"}); c != http.StatusNoContent {
			t.Fatalf("burst %d: %d", i, c)
		}
	}
	limited := map[string]any{"kind": "honk"}
	if c := send(bo, limited); c != http.StatusTooManyRequests {
		t.Fatalf("over burst: %d", c)
	}
	// a 429 doesn't burn the seq: the same message goes through once refilled
	advance(emoteRefill / 2)
	if c := send(bo, limited); c != http.StatusTooManyRequests {
		t.Fatalf("half refill: %d", c)
	}
	advance(emoteRefill / 2)
	drain := func(ch <-chan sseEvent) {
		for {
			select {
			case <-ch:
			case <-time.After(100 * time.Millisecond):
				return
			}
		}
	}
	drain(adaStream)
	if c := send(bo, limited); c != http.StatusNoContent {
		t.Fatalf("after refill: %d", c)
	}
	waitEvent(t, adaStream, "emote")
	if c := send(bo, map[string]any{"kind": "honk"}); c != http.StatusTooManyRequests {
		t.Fatalf("one refill is one emote: %d", c)
	}
	// a long wait refills to the burst, no further
	advance(100 * emoteRefill)
	for i := 0; i < emoteBurst; i++ {
		if c := send(bo, map[string]any{"kind": "honk"}); c != http.StatusNoContent {
			t.Fatalf("refilled burst %d: %d", i, c)
		}
	}
	if c := send(bo, map[string]any{"kind": "honk"}); c != http.StatusTooManyRequests {
		t.Fatalf("burst cap: %d", c)
	}
	// buckets are per member
	if c := send(cy, map[string]any{"kind": "honk"}); c != http.StatusNoContent {
		t.Fatalf("cy unaffected: %d", c)
	}
}

// One seat per name: a second "Pat" is refused unless they say it's them,
// and taking over keeps the seat (id, progress) and cuts off the old session.
func TestRoomDuplicateName(t *testing.T) {
	srv, rs := roomServer(t)
	_, body := postJSON(t, srv.URL+"/api/rooms", map[string]string{"name": "Host"})
	var host joinResp
	json.Unmarshal(body, &host)
	_, b := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "Pat"})
	var pat joinResp
	json.Unmarshal(b, &pat)
	if resp, b := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "pat"}); resp.StatusCode != http.StatusConflict || !strings.Contains(string(b), "name taken") {
		t.Fatalf("duplicate name: %d %s", resp.StatusCode, b)
	}
	resp, b := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]any{"name": "Pat", "takeover": true})
	if resp.StatusCode != 200 {
		t.Fatalf("takeover: %d", resp.StatusCode)
	}
	var again joinResp
	json.Unmarshal(b, &again)
	if again.You != pat.You || again.Token == pat.Token {
		t.Fatalf("takeover should keep the seat with a new token: %+v vs %+v", again.You, pat.You)
	}
	r := rs.get(host.Code)
	r.mu.Lock()
	n := len(r.members)
	r.mu.Unlock()
	if n != 2 {
		t.Fatalf("members after takeover: %d", n)
	}
	// the old session's credentials no longer work
	if resp, _ := postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/join", map[string]string{"name": "Pat", "id": pat.You, "token": pat.Token}); resp.StatusCode != http.StatusConflict {
		t.Fatalf("old session rejoin: %d", resp.StatusCode)
	}
}

func TestCleanLook(t *testing.T) {
	l := cleanLook("birdie", []string{"Sir Thud", "", "Clover", "A\x00B", "Five", "Six"})
	if l.Char != "birdie" || len(l.Balls) != 4 || l.Balls[0] != "Sir Thud" || l.Balls[2] != "AB" {
		t.Fatalf("cleanLook: %+v", l)
	}
	if cleanLook("Bad1", nil).Char != "" || cleanLook("averyveryverylongid", nil).Char != "" {
		t.Fatal("bad golfer ids must be dropped")
	}
}

func TestProgressAwards(t *testing.T) {
	ok := &Progress{Hole: 9, Scores: []int{4}, Awards: map[string]float64{"putt": 9.5, "goosed": 2, "peeled": 1}}
	if !validProgress(ok) {
		t.Fatal("awards should be valid")
	}
	for _, bad := range []map[string]float64{{"Putt": 1}, {"putt": -1}, {"putt": 1e9}, {"a": 1, "b": 1, "c": 1, "d": 1, "e": 1, "f": 1, "g": 1, "h": 1, "i": 1}} {
		if validProgress(&Progress{Awards: bad}) {
			t.Fatalf("awards %v should be rejected", bad)
		}
	}
}

// A member who leaves while their event stream is still open must not wedge
// the room: the stream's cleanup used to close the channel a second time.
func TestLeaveWithOpenStream(t *testing.T) {
	srv, rs := roomServer(t)
	_, body := postJSON(t, srv.URL+"/api/rooms", map[string]string{"name": "Host"})
	var host joinResp
	json.Unmarshal(body, &host)
	ev := openStream(t, srv.URL+"/api/rooms/"+host.Code+"/events?id="+host.You+"&token="+host.Token)
	waitEvent(t, ev, "roster")
	postJSON(t, srv.URL+"/api/rooms/"+host.Code+"/send", map[string]any{"id": host.You, "token": host.Token, "seq": 1, "type": "leave"})
	time.Sleep(150 * time.Millisecond) // the stream notices and runs its cleanup
	// the janitor's sweep takes every room's lock: it must not block on this one
	done := make(chan struct{})
	go func() { rs.sweep(time.Now()); close(done) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the room's lock was left held after a member left with an open stream")
	}
}
