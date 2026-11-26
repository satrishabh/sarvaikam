package main

import (
	"bytes"
	"encoding/json"
	"log"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJSONLogsUseCloudLoggingFields(t *testing.T) {
	previous := slog.Default()
	t.Cleanup(func() { slog.SetDefault(previous) })
	var out bytes.Buffer
	setupLogging("json", &out)

	slog.Warn("slow query", "ms", 1200)
	log.Print("from the standard logger")

	var lines []map[string]any
	for _, line := range bytes.Split(bytes.TrimSpace(out.Bytes()), []byte("\n")) {
		var m map[string]any
		if err := json.Unmarshal(line, &m); err != nil {
			t.Fatalf("not JSON: %s", line)
		}
		lines = append(lines, m)
	}
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	if lines[0]["severity"] != "WARNING" || lines[0]["message"] != "slow query" || lines[0]["ms"] != float64(1200) {
		t.Fatalf("unexpected warning line: %v", lines[0])
	}
	if lines[1]["severity"] != "INFO" || lines[1]["message"] != "from the standard logger" {
		t.Fatalf("standard log not routed through JSON: %v", lines[1])
	}
}

func TestPanicsBecomeErrorReportingEntries(t *testing.T) {
	previous := slog.Default()
	t.Cleanup(func() { slog.SetDefault(previous) })
	var out bytes.Buffer
	setupLogging("json", &out)

	rec := httptest.NewRecorder()
	recoverJSON(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })).
		ServeHTTP(rec, httptest.NewRequest("GET", "/api/progress/me", nil))

	if rec.Code != 500 {
		t.Fatalf("status %d, want 500", rec.Code)
	}
	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &entry); err != nil {
		t.Fatalf("not one JSON line: %s", out.String())
	}
	trace, _ := entry["stack_trace"].(string)
	if entry["severity"] != "ERROR" || !strings.HasPrefix(trace, "panic: boom\n\ngoroutine ") || entry["path"] != "/api/progress/me" {
		t.Fatalf("unexpected entry: %v", entry)
	}
}
