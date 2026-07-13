package main

import (
	"testing"
	"time"
)

func millis(date string) int64 {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		panic(err)
	}
	return t.UnixMilli()
}

func TestAggregateIncludesDateOfLatestBestScore(t *testing.T) {
	got := aggregate([]Entry{
		{Name: "Ada", Strokes: 8, TS: millis("2026-07-10")},
		{Name: "Ada", Strokes: 7, TS: millis("2026-07-11")},
		{Name: "Ada", Strokes: 7, TS: millis("2026-07-12")},
		{Name: "Grace", Strokes: 9, TS: millis("2026-07-09")},
	})

	if len(got) != 2 {
		t.Fatalf("got %d rows, want 2", len(got))
	}
	if got[0].Name != "Ada" || got[0].Strokes != 7 || got[0].Date != "2026-07-12" {
		t.Fatalf("unexpected first row: %+v", got[0])
	}
	if got[1].Date != "2026-07-09" {
		t.Fatalf("unexpected Grace date: %+v", got[1])
	}
}
