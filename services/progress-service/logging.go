package main

import (
	"fmt"
	"io"
	"log/slog"
	"os"
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
