package main

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
)

// setupLogging switches to one-JSON-object-per-line logs when LOG_FORMAT=json, with the field names Cloud
// Logging understands (severity, message, time). The standard log package is routed through it too.
func setupLogging(format string, out io.Writer) {
	if format != "json" {
		return
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(out, &slog.HandlerOptions{ReplaceAttr: cloudLoggingAttr})))
}

func cloudLoggingAttr(groups []string, a slog.Attr) slog.Attr {
	if len(groups) > 0 {
		return a
	}
	switch a.Key {
	case slog.LevelKey:
		a.Key = "severity"
		if level, ok := a.Value.Any().(slog.Level); ok && level >= slog.LevelWarn && level < slog.LevelError {
			a.Value = slog.StringValue("WARNING")
		}
	case slog.MessageKey:
		a.Key = "message"
	}
	return a
}

// fatal logs at ERROR severity (so alerts see it) and exits.
func fatal(format string, args ...any) {
	slog.Error(fmt.Sprintf(format, args...))
	os.Exit(1)
}

// recoverJSON turns a handler panic into a 500 and one ERROR log entry whose stack_trace Cloud Error Reporting
// groups (it reads Go's "panic: ...\n\ngoroutine N [running]:" format). Used instead of chi's text Recoverer
// when LOG_FORMAT=json.
func recoverJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec) // the client went away; let net/http handle it silently
			}
			slog.Error(fmt.Sprintf("panic: %v", rec),
				"stack_trace", fmt.Sprintf("panic: %v\n\n%s", rec, debug.Stack()),
				"path", r.URL.Path, "method", r.Method)
			w.WriteHeader(http.StatusInternalServerError)
		}()
		next.ServeHTTP(w, r)
	})
}
