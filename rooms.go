package main

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

// Rooms: live multiplayer for 2–8 friends sharing a room code. Every player
// simulates their own shots (the sim is deterministic but browsers may differ
// in the last bit of Math.sin), so the server never runs physics: it relays
// each shot's recorded frames and keeps a small progress snapshot per member
// so a late joiner or a reconnecting browser can resync from one message.
//
// Like the hole-out hub, rooms are in memory only. A deploy (stop-then-start,
// because the manifest has storage) ends every room; clients fall back to
// solo play. Nothing here touches S3 or the healthcheck.
//
// Emotes (heckles, honks, power-up attacks) are relayed opaquely: the server
// checks the shape of kind/to/arg and rate-limits each member, but the client
// decides what each kind means.

const (
	roomCodeChars   = "ABCDEFGHJKLMNPQRSTUVWXYZ" // no I or O: codes get read aloud
	roomCodeLen     = 4
	maxRooms        = 300
	maxRoomMembers  = 8
	roomIdleTimeout = 30 * time.Minute // no one connected for this long → room closes
	roomMaxAge      = 8 * time.Hour
	memberGrace     = 10 * time.Minute // offline members are kept this long (page reloads)
	roomSendLimit   = 64 << 10         // a long shot is ~8 KB of frames
	maxShotInts     = 3600             // 28 s of 30 Hz frames × 3 coordinates, with headroom
	connBuffer      = 64
	maxEmoteKind    = 24 // bytes; kinds are [a-z0-9_-]
	maxEmoteArg     = 64 // bytes, after control characters are stripped
	emoteBurst      = 5  // emotes a member can fire back to back
)

// emoteRefill is how long the bucket takes to earn back one emote, and
// emoteClock is what it is measured against. Both are vars so tests can
// drive the bucket without sleeping.
var (
	emoteRefill = 1500 * time.Millisecond
	emoteClock  = time.Now
)

type Rooms struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

type Room struct {
	mu         sync.Mutex
	code       string
	hostID     string
	round      int
	seed       uint32
	started    bool
	members    map[string]*Member
	order      []string // join order, for host hand-off and colour stability
	created    time.Time
	lastActive time.Time // last time anyone was connected
}

type Member struct {
	ID       string
	Name     string
	Color    int
	token    string
	joined   time.Time
	lastSeen time.Time
	lastSeq  int
	conns    map[chan []byte]struct{}
	Progress Progress
	Look     Look // golfer and balls picked on the title card (lobby display)

	emoteTokens float64   // token bucket for emotes; see allowEmoteLocked
	emoteAt     time.Time // when emoteTokens was last brought up to date
}

// Progress is a member's standing in the current round. Decoding into a
// struct is the sanitiser: unknown fields are dropped, types are enforced.
type Progress struct {
	Hole    int    `json:"hole"`    // 1-based hole being played (or last played when done)
	Strokes int    `json:"strokes"` // strokes on that hole so far, penalties included
	Scores  []int  `json:"scores"`  // completed holes
	Rest    *Vec3  `json:"rest,omitempty"`
	Holed   bool   `json:"holed"`
	Done    bool   `json:"done"`
	Ball    string `json:"ball,omitempty"`
	Char    string `json:"char,omitempty"` // chosen golfer model, cosmetic
}

// Look is what a member picked on the title card, shown in the lobby before
// any round starts (council round 8, S13). Cosmetic only.
type Look struct {
	Char  string   `json:"char,omitempty"`
	Balls []string `json:"balls,omitempty"`
}

// cleanLook keeps a golfer id of 1-12 lowercase letters and up to four
// cleaned ball names.
func cleanLook(char string, balls []string) Look {
	var l Look
	if len(char) <= 12 {
		ok := char != ""
		for i := 0; i < len(char); i++ {
			if char[i] < 'a' || char[i] > 'z' {
				ok = false
			}
		}
		if ok {
			l.Char = char
		}
	}
	for _, b := range balls {
		if len(l.Balls) == 4 {
			break
		}
		if b = cleanName(b); b != "" {
			l.Balls = append(l.Balls, b)
		}
	}
	return l
}

type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type rosterMember struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Color    int      `json:"color"`
	Online   bool     `json:"online"`
	Host     bool     `json:"host"`
	Progress Progress `json:"progress"`
	Look     Look     `json:"look"`
}

type roomState struct {
	Code    string         `json:"code"`
	Round   int            `json:"round"`
	Seed    uint32         `json:"seed"`
	Started bool           `json:"started"`
	HostID  string         `json:"hostId"`
	Members []rosterMember `json:"members"`
}

func newRooms() *Rooms {
	rs := &Rooms{rooms: map[string]*Room{}}
	go rs.janitor()
	return rs
}

func randToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func randSeed() uint32 {
	var b [4]byte
	rand.Read(b[:])
	return binary.LittleEndian.Uint32(b[:]) | 1
}

func newRoomCode() string {
	b := make([]byte, roomCodeLen)
	rand.Read(b)
	for i := range b {
		b[i] = roomCodeChars[int(b[i])%len(roomCodeChars)]
	}
	return string(b)
}

func (rs *Rooms) get(code string) *Room {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	return rs.rooms[strings.ToUpper(code)]
}

func (rs *Rooms) create() *Room {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if len(rs.rooms) >= maxRooms {
		return nil
	}
	for {
		code := newRoomCode()
		if _, taken := rs.rooms[code]; taken {
			continue
		}
		now := time.Now()
		r := &Room{code: code, round: 1, seed: randSeed(), members: map[string]*Member{}, created: now, lastActive: now}
		rs.rooms[code] = r
		return r
	}
}

// janitor closes idle rooms and forgets members who left long ago.
func (rs *Rooms) janitor() {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for range t.C {
		rs.sweep(time.Now())
	}
}

func (rs *Rooms) sweep(now time.Time) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	for code, r := range rs.rooms {
		r.mu.Lock()
		changed := false
		online := 0
		for id, m := range r.members {
			if len(m.conns) > 0 {
				online++
				continue
			}
			if now.Sub(m.lastSeen) > memberGrace {
				r.removeLocked(id)
				changed = true
			}
		}
		if online > 0 {
			r.lastActive = now
		}
		dead := now.Sub(r.lastActive) > roomIdleTimeout || now.Sub(r.created) > roomMaxAge || len(r.members) == 0 && now.Sub(r.created) > memberGrace
		if dead {
			for _, m := range r.members {
				for ch := range m.conns {
					close(ch)
				}
				m.conns = nil
			}
		} else if changed {
			r.broadcastLocked("roster", r.stateLocked(), "")
		}
		r.mu.Unlock()
		if dead {
			delete(rs.rooms, code)
		}
	}
}

// ---- room internals (callers hold r.mu) ----

func (r *Room) stateLocked() roomState {
	st := roomState{Code: r.code, Round: r.round, Seed: r.seed, Started: r.started, HostID: r.hostID}
	for _, id := range r.order {
		m := r.members[id]
		st.Members = append(st.Members, rosterMember{ID: m.ID, Name: m.Name, Color: m.Color, Online: len(m.conns) > 0, Host: m.ID == r.hostID, Progress: m.Progress, Look: m.Look})
	}
	return st
}

func (r *Room) addLocked(name string) *Member {
	used := map[int]bool{}
	for _, m := range r.members {
		used[m.Color] = true
	}
	color := 0
	for used[color] {
		color++
	}
	now := time.Now()
	m := &Member{ID: randToken(6), Name: name, Color: color, token: randToken(16), joined: now, lastSeen: now, conns: map[chan []byte]struct{}{}, emoteTokens: emoteBurst, emoteAt: emoteClock()}
	r.members[m.ID] = m
	r.order = append(r.order, m.ID)
	if r.hostID == "" {
		r.hostID = m.ID
	}
	return m
}

// byNameLocked finds a member by name, ignoring case.
func (r *Room) byNameLocked(name string) *Member {
	for _, id := range r.order {
		if m := r.members[id]; strings.EqualFold(m.Name, name) {
			return m
		}
	}
	return nil
}

func (r *Room) removeLocked(id string) {
	m, ok := r.members[id]
	if !ok {
		return
	}
	for ch := range m.conns {
		close(ch)
	}
	delete(r.members, id)
	for i, oid := range r.order {
		if oid == id {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}
	if r.hostID == id {
		r.hostID = ""
		// hand the room to whoever is online and joined earliest
		for _, oid := range r.order {
			if len(r.members[oid].conns) > 0 {
				r.hostID = oid
				break
			}
		}
		if r.hostID == "" && len(r.order) > 0 {
			r.hostID = r.order[0]
		}
	}
}

// broadcastLocked queues one SSE event for every connection except the
// sender's. A connection whose buffer is full is closed rather than silently
// skipped: the browser reconnects and the roster snapshot resyncs it.
func (r *Room) broadcastLocked(event string, data any, except string) {
	body, err := json.Marshal(data)
	if err != nil {
		log.Printf("room %s: encode %s: %v", r.code, event, err)
		return
	}
	msg := sseFrame(event, body)
	for id, m := range r.members {
		if id == except {
			continue
		}
		for ch := range m.conns {
			select {
			case ch <- msg:
			default:
				delete(m.conns, ch)
				close(ch)
			}
		}
	}
}

func sseFrame(event string, body []byte) []byte {
	var b strings.Builder
	b.WriteString("event: ")
	b.WriteString(event)
	b.WriteString("\ndata: ")
	b.Write(body)
	b.WriteString("\n\n")
	return []byte(b.String())
}

func (r *Room) auth(id, token string) *Member {
	m, ok := r.members[id]
	if !ok || token == "" || m.token != token {
		return nil
	}
	return m
}

// ---- HTTP ----

type joinReq struct {
	Name     string `json:"name"`
	ID       string `json:"id"`       // rejoin with an existing identity (page reload)
	Token    string `json:"token"`    //
	Takeover bool     `json:"takeover"` // "that's me": take over the seat of a member with this name
	Char     string   `json:"char"`     // the golfer and balls picked on the title card
	Balls    []string `json:"balls"`    //
}

type joinResp struct {
	roomState
	You   string `json:"you"`
	Token string `json:"token"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (rs *Rooms) register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/rooms", rs.serveCreate)
	mux.HandleFunc("POST /api/rooms/{code}/join", rs.serveJoin)
	mux.HandleFunc("GET /api/rooms/{code}/events", rs.serveEvents)
	mux.HandleFunc("POST /api/rooms/{code}/send", rs.serveSend)
}

func readJoin(w http.ResponseWriter, r *http.Request) (joinReq, bool) {
	var in joinReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&in); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return in, false
	}
	in.Name = cleanName(in.Name)
	if in.Name == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return in, false
	}
	return in, true
}

func (rs *Rooms) serveCreate(w http.ResponseWriter, r *http.Request) {
	in, ok := readJoin(w, r)
	if !ok {
		return
	}
	room := rs.create()
	if room == nil {
		http.Error(w, "too many rooms right now", http.StatusServiceUnavailable)
		return
	}
	room.mu.Lock()
	m := room.addLocked(in.Name)
	m.Look = cleanLook(in.Char, in.Balls)
	resp := joinResp{roomState: room.stateLocked(), You: m.ID, Token: m.token}
	room.mu.Unlock()
	log.Printf("room %s: created", room.code)
	writeJSON(w, http.StatusOK, resp)
}

func (rs *Rooms) serveJoin(w http.ResponseWriter, r *http.Request) {
	in, ok := readJoin(w, r)
	if !ok {
		return
	}
	room := rs.get(r.PathValue("code"))
	if room == nil {
		http.Error(w, "no such room", http.StatusNotFound)
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	m := room.auth(in.ID, in.Token)
	if m != nil {
		m.Name = in.Name // a rejoin may rename
	} else if dup := room.byNameLocked(in.Name); dup != nil {
		// One seat per name (council round 8, S5): a second session with the
		// same name is asked "is that you?". Saying yes takes over the seat,
		// progress and all, and the old session is cut off (new token).
		if !in.Takeover {
			http.Error(w, "name taken", http.StatusConflict)
			return
		}
		m = dup
		m.token = randToken(16)
		for ch := range m.conns {
			delete(m.conns, ch)
			close(ch)
		}
	} else {
		if len(room.members) >= maxRoomMembers {
			http.Error(w, "room is full", http.StatusConflict)
			return
		}
		m = room.addLocked(in.Name)
	}
	m.lastSeen = time.Now()
	m.Look = cleanLook(in.Char, in.Balls)
	st := room.stateLocked()
	room.broadcastLocked("roster", st, m.ID)
	writeJSON(w, http.StatusOK, joinResp{roomState: st, You: m.ID, Token: m.token})
}

func (rs *Rooms) serveEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	room := rs.get(r.PathValue("code"))
	if room == nil {
		// 404 tells EventSource to stop retrying: the room is gone
		http.Error(w, "no such room", http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	room.mu.Lock()
	m := room.auth(q.Get("id"), q.Get("token"))
	if m == nil {
		room.mu.Unlock()
		http.Error(w, "not a member", http.StatusForbidden)
		return
	}
	ch := make(chan []byte, connBuffer)
	m.conns[ch] = struct{}{}
	m.lastSeen = time.Now()
	room.lastActive = time.Now()
	st := room.stateLocked()
	snap, _ := json.Marshal(st)
	room.broadcastLocked("roster", st, m.ID)
	room.mu.Unlock()

	defer func() {
		room.mu.Lock()
		if _, live := m.conns[ch]; live {
			delete(m.conns, ch)
			close(ch)
		}
		m.lastSeen = time.Now()
		if room.members[m.ID] == m && len(m.conns) == 0 {
			room.broadcastLocked("roster", room.stateLocked(), m.ID)
		}
		room.mu.Unlock()
	}()

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	// Every (re)connect starts with the full snapshot, so a dropped
	// connection loses nothing that matters: progress carries rest positions.
	w.Write([]byte("retry: 1500\n"))
	w.Write(sseFrame("roster", snap))
	flusher.Flush()

	ping := time.NewTicker(20 * time.Second) // under the ALB's 60 s idle timeout
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			w.Write(msg)
			flusher.Flush()
		case <-ping.C:
			w.Write([]byte(": ping\n\n"))
			flusher.Flush()
		}
	}
}

// sendReq is everything a client can tell the room. Type picks the meaning.
type sendReq struct {
	ID       string    `json:"id"`
	Token    string    `json:"token"`
	Seq      int       `json:"seq"`   // per-member, increasing: retries are idempotent
	Type     string    `json:"type"`  // shot | progress | start | leave | emote
	Round    int       `json:"round"` // round the event belongs to (shot/progress; emote passes it through)
	Hole     int       `json:"hole"`
	Stroke   int       `json:"stroke"`
	Start    *Vec3     `json:"start,omitempty"`
	Res      string    `json:"res"`
	Club     string    `json:"club"`
	F        []int     `json:"f"`
	Wm       int       `json:"wm"` // shot: windmill blade phase at launch, milliradians
	Progress *Progress `json:"progress,omitempty"`
	Kind     string    `json:"kind"` // emote: what happened, meaning is up to the client
	To       string    `json:"to"`   // emote: target member id, empty for everyone
	Arg      string    `json:"arg"`  // emote: optional free text
}

type shotEvent struct {
	From     string    `json:"from"`
	Round    int       `json:"round"`
	Hole     int       `json:"hole"`
	Stroke   int       `json:"stroke"`
	Start    Vec3      `json:"start"`
	Res      string    `json:"res"`
	Club     string    `json:"club"`
	F        []int     `json:"f"`
	Wm       int       `json:"wm"`
	Progress *Progress `json:"progress,omitempty"`
}

type progressEvent struct {
	From     string   `json:"from"`
	Round    int      `json:"round"`
	Progress Progress `json:"progress"`
}

type startEvent struct {
	Round int    `json:"round"`
	Seed  uint32 `json:"seed"`
	By    string `json:"by"`
}

// emoteEvent goes to everyone but the sender, targeted or not, so the rest of
// the room can see who heckled whom.
type emoteEvent struct {
	From  string `json:"from"`
	Kind  string `json:"kind"`
	To    string `json:"to"`
	Arg   string `json:"arg"`
	Round int    `json:"round"`
}

var validRes = map[string]bool{"rest": true, "holed": true, "water": true, "oob": true}
var validClub = map[string]bool{"driver": true, "wood": true, "iron": true, "wedge": true, "putter": true}

func validProgress(p *Progress) bool {
	if p == nil {
		return true
	}
	if p.Hole < 0 || p.Hole > 18 || p.Strokes < 0 || p.Strokes > 99 || len(p.Scores) > 18 || len(p.Ball) > 40 || len(p.Char) > 16 {
		return false
	}
	for _, s := range p.Scores {
		if s < 1 || s > 99 {
			return false
		}
	}
	return true
}

func validEmoteKind(k string) bool {
	if len(k) < 1 || len(k) > maxEmoteKind {
		return false
	}
	for i := 0; i < len(k); i++ {
		c := k[i]
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}

// cleanArg strips control characters like cleanName, but does not truncate:
// the caller rejects an over-long arg rather than silently cutting it.
func cleanArg(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == utf8.RuneError {
			return -1
		}
		return r
	}, s)
	return strings.TrimSpace(s)
}

// allowEmoteLocked takes one token from the member's emote bucket (burst
// emoteBurst, one token back per emoteRefill), or reports false when empty.
func (m *Member) allowEmoteLocked() bool {
	now := emoteClock()
	if elapsed := now.Sub(m.emoteAt); elapsed > 0 {
		m.emoteTokens = min(emoteBurst, m.emoteTokens+float64(elapsed)/float64(emoteRefill))
	}
	m.emoteAt = now
	if m.emoteTokens < 1 {
		return false
	}
	m.emoteTokens--
	return true
}

func (rs *Rooms) serveSend(w http.ResponseWriter, r *http.Request) {
	room := rs.get(r.PathValue("code"))
	if room == nil {
		http.Error(w, "no such room", http.StatusNotFound)
		return
	}
	var in sendReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, roomSendLimit)).Decode(&in); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if !validProgress(in.Progress) {
		http.Error(w, "bad progress", http.StatusBadRequest)
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	m := room.auth(in.ID, in.Token)
	if m == nil {
		http.Error(w, "not a member", http.StatusForbidden)
		return
	}
	m.lastSeen = time.Now()
	if in.Seq <= m.lastSeq {
		w.WriteHeader(http.StatusNoContent) // a retry of something already relayed
		return
	}
	switch in.Type {
	case "shot", "progress":
		if in.Round != room.round {
			http.Error(w, "stale round", http.StatusConflict)
			return
		}
		if in.Type == "shot" {
			if in.Start == nil || in.Hole < 1 || in.Hole > 18 || in.Stroke < 1 || in.Stroke > 99 || !validRes[in.Res] || !validClub[in.Club] || len(in.F) < 3 || len(in.F) > maxShotInts || len(in.F)%3 != 0 || in.Wm < 0 || in.Wm > 6284 {
				http.Error(w, "bad shot", http.StatusBadRequest)
				return
			}
		} else if in.Progress == nil {
			http.Error(w, "progress required", http.StatusBadRequest)
			return
		}
		m.lastSeq = in.Seq
		if in.Progress != nil {
			m.Progress = *in.Progress
		}
		if in.Type == "shot" {
			room.broadcastLocked("shot", shotEvent{From: m.ID, Round: in.Round, Hole: in.Hole, Stroke: in.Stroke, Start: *in.Start, Res: in.Res, Club: in.Club, F: in.F, Wm: in.Wm, Progress: in.Progress}, m.ID)
		} else {
			room.broadcastLocked("progress", progressEvent{From: m.ID, Round: in.Round, Progress: m.Progress}, m.ID)
		}
	case "start":
		if m.ID != room.hostID {
			http.Error(w, "only the host can start", http.StatusForbidden)
			return
		}
		m.lastSeq = in.Seq
		if room.started {
			room.round++
			room.seed = randSeed()
		}
		room.started = true
		for _, o := range room.members {
			o.Progress = Progress{}
		}
		log.Printf("room %s: round %d started (%d players)", room.code, room.round, len(room.members))
		// everyone, sender included: the start event is what kicks off play
		room.broadcastLocked("start", startEvent{Round: room.round, Seed: room.seed, By: m.ID}, "")
		room.broadcastLocked("roster", room.stateLocked(), "")
		writeJSON(w, http.StatusOK, startEvent{Round: room.round, Seed: room.seed, By: m.ID})
		return
	case "emote":
		// no round check: emotes work in the lobby and between rounds too
		in.Arg = cleanArg(in.Arg)
		if !validEmoteKind(in.Kind) || len(in.Arg) > maxEmoteArg {
			http.Error(w, "bad emote", http.StatusBadRequest)
			return
		}
		if in.To != "" {
			if _, ok := room.members[in.To]; !ok || in.To == m.ID {
				http.Error(w, "bad emote target", http.StatusBadRequest)
				return
			}
		}
		if !m.allowEmoteLocked() {
			// lastSeq stays put, so the same seq can be sent again later
			http.Error(w, "slow down", http.StatusTooManyRequests)
			return
		}
		m.lastSeq = in.Seq
		room.broadcastLocked("emote", emoteEvent{From: m.ID, Kind: in.Kind, To: in.To, Arg: in.Arg, Round: in.Round}, m.ID)
	case "leave":
		m.lastSeq = in.Seq
		room.removeLocked(m.ID)
		room.broadcastLocked("roster", room.stateLocked(), "")
	default:
		http.Error(w, "unknown type", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// sortedCodes is for tests and debugging.
func (rs *Rooms) sortedCodes() []string {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	out := make([]string, 0, len(rs.rooms))
	for c := range rs.rooms {
		out = append(out, c)
	}
	sort.Strings(out)
	return out
}
