package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Hub is an in-memory fan-out for live "someone finished a hole" events.
// It's ephemeral by design — nothing is persisted, only currently-connected
// players receive events, which is exactly the "playing at the same time"
// semantics we want. No S3, no dependency on the healthcheck.
type Hub struct {
	mu      sync.Mutex
	clients map[chan []byte]struct{}
}

func newHub() *Hub {
	return &Hub{clients: make(map[chan []byte]struct{})}
}

func (h *Hub) add() chan []byte {
	ch := make(chan []byte, 8)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) remove(ch chan []byte) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

func (h *Hub) broadcast(msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- msg:
		default: // slow/full client — drop this event rather than block everyone
		}
	}
}

// HoleOut is a live hole-completion event. ID identifies the sending client so
// each browser can ignore its own events (handles duplicate display names too).
type HoleOut struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Hole    int    `json:"hole"`
	Strokes int    `json:"strokes"`
}

// serveSSE streams events to one client over Server-Sent Events. SSE (not
// websockets) because the feed is one-directional and rides plain HTTP cleanly
// through the load balancer.
func (h *Hub) serveSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := h.add()
	defer h.remove(ch)

	w.Write([]byte(": connected\n\n"))
	flusher.Flush()

	// Heartbeat under the ALB's 60s idle timeout so the stream stays open.
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			w.Write([]byte("event: holeout\ndata: "))
			w.Write(msg)
			w.Write([]byte("\n\n"))
			flusher.Flush()
		case <-ping.C:
			w.Write([]byte(": ping\n\n"))
			flusher.Flush()
		}
	}
}

// serveHole accepts a hole-completion and fans it out to everyone else.
func (h *Hub) serveHole(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var in HoleOut
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&in); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) > 20 {
		in.Name = in.Name[:20]
	}
	if in.Name == "" || in.Hole <= 0 || in.Strokes <= 0 {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	msg, err := json.Marshal(in)
	if err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
		return
	}
	h.broadcast(msg)
	w.WriteHeader(http.StatusNoContent)
}
