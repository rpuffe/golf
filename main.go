package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "embed"
)

//go:embed index.html
var indexHTML []byte

func main() {
	port := getenv("PORT", "8080")
	store := newStore(context.Background(), os.Getenv("STORAGE_BUCKET"))

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
		in.Name = strings.TrimSpace(in.Name)
		if len(in.Name) > 20 {
			in.Name = in.Name[:20]
		}
		if in.Name == "" || in.Strokes <= 0 || in.Strokes > 9999 {
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
		writeLeaderboards(w, r, store)
	})

	mux.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		writeLeaderboards(w, r, store)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})

	addr := "0.0.0.0:" + port
	log.Printf("golf listening on %s", addr)
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
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

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
