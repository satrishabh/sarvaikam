package main

import (
	"context"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCurrentSessionControlsAuthorization(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		status int
		body   string
		want   int
	}{
		{"active", 200, `{"id":"person","permissions":["candidates.view"]}`, 204},
		{"suspended", 401, `{"message":"unavailable"}`, 401},
		{"wrong subject", 200, `{"id":"other","permissions":[]}`, 401},
		{"malformed", 200, `{`, 401},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") == "" {
					t.Error("missing forwarded token")
				}
				w.WriteHeader(scenario.status)
				w.Write([]byte(scenario.body))
			}))
			defer upstream.Close()
			t.Setenv("AUTH_SERVICE_URL", upstream.URL)
			secret := []byte("test-secret-of-at-least-32-characters")
			raw, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "person", "role": "ADMIN", "exp": time.Now().Add(time.Minute).Unix()}).SignedString(secret)
			s := &server{secret: secret, client: upstream.Client()}
			req := httptest.NewRequest("GET", "/", nil)
			req.Header.Set("Authorization", "Bearer "+raw)
			response := httptest.NewRecorder()
			s.auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if userID(r) != "person" {
					t.Error("wrong subject")
				}
				w.WriteHeader(204)
			})).ServeHTTP(response, req)
			if response.Code != scenario.want {
				t.Fatalf("got %d want %d", response.Code, scenario.want)
			}
		})
	}
}

func TestCandidateProgressRequiresCurrentPermission(t *testing.T) {
	s := &server{}
	req := httptest.NewRequest("GET", "/users/person", nil)
	req = req.WithContext(context.WithValue(req.Context(), permissionsKey{}, []string{"assets.download"}))
	response := httptest.NewRecorder()
	s.listUser(response, req)
	if response.Code != 403 {
		t.Fatalf("got %d want 403", response.Code)
	}
}

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
