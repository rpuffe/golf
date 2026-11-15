package main

import (
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"embed"
)

// web/ holds the whole client: index.html, the game modules, and the
// vendored Three.js build (the CSP allows same-origin scripts only, so no CDN).
//
//go:embed web
var webFiles embed.FS

// minRoundStrokes is one stroke per hole on the 9-hole 3D course.
const minRoundStrokes = 9

func main() {
	port := getenv("PORT", "8080")
	store := newStore(context.Background(), os.Getenv("STORAGE_BUCKET"))
	hub := newHub()

	mux := http.NewServeMux()

	// Healthcheck: static, dependency-free — must never touch S3.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok\n"))
	})

	mux.HandleFunc("/api/score", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var in struct {
			Name    string `json:"name"`
			Strokes int    `json:"strokes"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&in); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		in.Name = cleanName(in.Name)
		// A round is 7 holes: fewer than 7 strokes is impossible, and anything
		// past 200 is a stuck client, not golf.
		if in.Name == "" || in.Strokes < minRoundStrokes || in.Strokes > 200 {
			http.Error(w, "invalid name or score", http.StatusBadRequest)
			return
		}
		e := Entry{Name: in.Name, Strokes: in.Strokes, TS: time.Now().UnixMilli()}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := store.Save(ctx, e); err != nil {
			log.Printf("save score: %v", err)
			http.Error(w, "storage error", http.StatusBadGateway)
			return
		}
		// Emitted only on a successfully stored score, which is the one
		// signal that means a human actually finished a round -- page loads,
		// asset fetches and bot traffic never reach here. The manifest's
		// "round-played" alert matches this exact prefix, so keep the two in
		// step if this line is ever reworded.
		log.Printf("round complete: strokes=%d", e.Strokes)
		writeLeaderboards(w, r, store)
	})

	mux.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		writeLeaderboards(w, r, store)
	})

	// Live social feed: subscribe (SSE) and publish hole-completions.
	mux.HandleFunc("/api/events", hub.serveSSE)
	mux.HandleFunc("/api/hole", hub.serveHole)

	// Multiplayer rooms: create/join by code, then an SSE stream per player.
	newRooms().register(mux)

	webRoot, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal(err)
	}
	// Local development only: WEB_DIR=web serves the client from disk so edits
	// show on reload without rebuilding. Never set in the deployed image.
	if dir := os.Getenv("WEB_DIR"); dir != "" {
		webRoot = os.DirFS(dir)
		log.Printf("serving client from disk: %s", dir)
	}
	static := http.FileServer(http.FS(webRoot))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Embedded files carry no modtime, so steer caching explicitly: the
		// pinned library is immutable per release, everything else revalidates.
		if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r) // no directory listings
			return
		}
		if strings.HasPrefix(r.URL.Path, "/lib/") {
			w.Header().Set("Cache-Control", "public, max-age=86400")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		static.ServeHTTP(w, r)
	})

	addr := "0.0.0.0:" + port
	log.Printf("golf listening on %s", addr)
	srv := &http.Server{
		Addr:              addr,
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}

func writeLeaderboards(w http.ResponseWriter, r *http.Request, store Store) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	allTime, today, err := store.Leaderboards(ctx)
	if err != nil {
		log.Printf("leaderboards: %v", err)
		http.Error(w, "storage error", http.StatusBadGateway)
		return
	}
	if allTime == nil {
		allTime = []Score{}
	}
	if today == nil {
		today = []Score{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"allTime": allTime, "today": today})
}

// cleanName trims a player name, drops control characters, and caps it at 20
// characters (runes, so a multi-byte name is never cut mid-character).
func cleanName(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == utf8.RuneError {
			return -1
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > 20 {
		s = strings.TrimSpace(string(r[:20]))
	}
	return s
}

// securityHeaders sets conservative browser hardening on every response. The
// page is one self-contained file (inline script + style, no third-party
// assets), so the CSP only needs to allow inline code and same-origin fetches.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
