package main

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// The entrypoint builds a keyword/value DSN with a quoted password; make sure pgx parses awkward passwords.
func TestEntrypointDSNParses(t *testing.T) {
	cfg, err := pgxpool.ParseConfig(`host=db.example.com port=5432 dbname=sarvaikam user=app password='p@ss/w?rd#1\'q\\x' sslmode=require`)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := cfg.ConnConfig.Password, `p@ss/w?rd#1'q\x`; got != want {
		t.Fatalf("password = %q, want %q", got, want)
	}
	if cfg.ConnConfig.Host != "db.example.com" || cfg.ConnConfig.Database != "sarvaikam" {
		t.Fatalf("unexpected config: %+v", cfg.ConnConfig)
	}
}

func TestSplitList(t *testing.T) {
	got := splitList(" http://a/health, ,http://b/health ")
	if len(got) != 2 || got[0] != "http://a/health" || got[1] != "http://b/health" {
		t.Fatalf("splitList = %v", got)
	}
}
