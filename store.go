package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Entry is one completed round, stored append-only so concurrent writers
// never clobber each other (each round is its own object / slice element).
type Entry struct {
	Name    string `json:"name"`
	Strokes int    `json:"strokes"`
	TS      int64  `json:"ts"` // unix millis
}

// Score is one row on a leaderboard: a player's best (fewest) strokes.
type Score struct {
	Name    string `json:"name"`
	Strokes int    `json:"strokes"`
	Date    string `json:"date"`
}

// Store persists rounds and answers leaderboard queries. Two implementations:
// S3 when a bucket is injected, in-memory otherwise. The healthcheck never
// touches this, so a slow/absent S3 can't fail startup (see docs/contract.md).
type Store interface {
	Save(ctx context.Context, e Entry) error
	// Leaderboards returns best-per-player all-time and best-per-player for
	// the current UTC day, each sorted ascending (fewest strokes first).
	Leaderboards(ctx context.Context) (allTime, today []Score, err error)
}

const leaderboardLimit = 10

func dayKey(tsMillis int64) string {
	return time.UnixMilli(tsMillis).UTC().Format("2006-01-02")
}

// aggregate reduces raw entries to best-per-player, sorted and capped.
func aggregate(entries []Entry) []Score {
	best := map[string]Entry{}
	for _, e := range entries {
		if b, ok := best[e.Name]; !ok || e.Strokes < b.Strokes || (e.Strokes == b.Strokes && e.TS > b.TS) {
			best[e.Name] = e
		}
	}
	out := make([]Score, 0, len(best))
	for name, entry := range best {
		out = append(out, Score{Name: name, Strokes: entry.Strokes, Date: dayKey(entry.TS)})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Strokes != out[j].Strokes {
			return out[i].Strokes < out[j].Strokes
		}
		return out[i].Name < out[j].Name
	})
	if len(out) > leaderboardLimit {
		out = out[:leaderboardLimit]
	}
	return out
}

// ---- in-memory ----

type MemStore struct {
	mu      sync.RWMutex
	entries []Entry
}

func (m *MemStore) Save(_ context.Context, e Entry) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.entries = append(m.entries, e)
	return nil
}

func (m *MemStore) Leaderboards(_ context.Context) ([]Score, []Score, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	today := dayKey(time.Now().UnixMilli())
	var todays []Entry
	for _, e := range m.entries {
		if dayKey(e.TS) == today {
			todays = append(todays, e)
		}
	}
	return aggregate(m.entries), aggregate(todays), nil
}

// ---- S3 (append-only object per round) ----

type S3Store struct {
	client *s3.Client
	bucket string
}

const scorePrefix = "scores/"

func (s *S3Store) Save(ctx context.Context, e Entry) error {
	body, err := json.Marshal(e)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("%s%s/%d-%06d.json", scorePrefix, dayKey(e.TS), e.TS, rand.Intn(1000000))
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   strings.NewReader(string(body)),
	})
	return err
}

func (s *S3Store) Leaderboards(ctx context.Context) ([]Score, []Score, error) {
	var entries []Entry
	var token *string
	for {
		out, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(s.bucket),
			Prefix:            aws.String(scorePrefix),
			ContinuationToken: token,
		})
		if err != nil {
			return nil, nil, err
		}
		for _, obj := range out.Contents {
			e, err := s.get(ctx, aws.ToString(obj.Key))
			if err != nil {
				log.Printf("skip %s: %v", aws.ToString(obj.Key), err)
				continue
			}
			entries = append(entries, e)
		}
		if out.IsTruncated == nil || !*out.IsTruncated {
			break
		}
		token = out.NextContinuationToken
	}
	today := dayKey(time.Now().UnixMilli())
	var todays []Entry
	for _, e := range entries {
		if dayKey(e.TS) == today {
			todays = append(todays, e)
		}
	}
	return aggregate(entries), aggregate(todays), nil
}

func (s *S3Store) get(ctx context.Context, key string) (Entry, error) {
	var e Entry
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return e, err
	}
	defer out.Body.Close()
	data, err := io.ReadAll(out.Body)
	if err != nil {
		return e, err
	}
	return e, json.Unmarshal(data, &e)
}

// newStore picks S3 when STORAGE_BUCKET is set and the AWS SDK can load
// credentials; otherwise it degrades to in-memory (local dev, or no storage).
func newStore(ctx context.Context, bucket string) Store {
	if bucket == "" {
		log.Print("storage: in-memory (STORAGE_BUCKET unset)")
		return &MemStore{}
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		log.Printf("storage: in-memory fallback (aws config: %v)", err)
		return &MemStore{}
	}
	log.Printf("storage: s3 bucket %q", bucket)
	return &S3Store{client: s3.NewFromConfig(cfg), bucket: bucket}
}
