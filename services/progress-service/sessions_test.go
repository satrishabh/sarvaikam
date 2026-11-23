package main

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// sessionHarness serves a scripted auth-service and counts how often /me is called.
type sessionHarness struct {
	status atomic.Int32
	calls  atomic.Int32
	clock  time.Time
	s      *server
	token  string
}

func newSessionHarness(t *testing.T) *sessionHarness {
	h := &sessionHarness{clock: time.Unix(1_800_000_000, 0)}
	h.status.Store(200)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		h.calls.Add(1)
		code := int(h.status.Load())
		w.WriteHeader(code)
		if code == 200 {
			w.Write([]byte(`{"id":"person","permissions":["candidates.view"]}`))
		}
	}))
	t.Cleanup(upstream.Close)
	t.Setenv("AUTH_SERVICE_URL", upstream.URL)
	secret := []byte("test-secret-of-at-least-32-characters")
	h.token, _ = jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": "person", "exp": time.Now().Add(time.Hour).Unix()}).SignedString(secret)
	cache := newSessionCache(30*time.Second, 5*time.Minute, 100)
	cache.now = func() time.Time { return h.clock }
	h.s = &server{secret: secret, client: upstream.Client(), sessions: cache}
	return h
}

func (h *sessionHarness) request() int {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+h.token)
	rec := httptest.NewRecorder()
	h.s.auth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) })).ServeHTTP(rec, req)
	return rec.Code
}

func TestSessionCacheAvoidsRepeatCalls(t *testing.T) {
	h := newSessionHarness(t)
	for i := 0; i < 3; i++ {
		if got := h.request(); got != 204 {
			t.Fatalf("request %d: got %d want 204", i, got)
		}
	}
	if got := h.calls.Load(); got != 1 {
		t.Fatalf("auth-service called %d times within the fresh window, want 1", got)
	}
	h.clock = h.clock.Add(31 * time.Second)
	h.request()
	if got := h.calls.Load(); got != 2 {
		t.Fatalf("auth-service called %d times after the fresh window, want 2", got)
	}
}

func TestSessionCacheServesStaleWhileAuthIsDown(t *testing.T) {
	h := newSessionHarness(t)
	h.request()
	h.status.Store(503)
	h.clock = h.clock.Add(2 * time.Minute)
	if got := h.request(); got != 204 {
		t.Fatalf("within the stale window: got %d want 204", got)
	}
	h.clock = h.clock.Add(4 * time.Minute)
	if got := h.request(); got != 503 {
		t.Fatalf("past the stale window: got %d want 503", got)
	}
}

func TestSessionCacheNeverServesARejectedSession(t *testing.T) {
	h := newSessionHarness(t)
	h.request()
	h.clock = h.clock.Add(31 * time.Second)
	h.status.Store(401) // suspended
	if got := h.request(); got != 401 {
		t.Fatalf("suspended: got %d want 401", got)
	}
	h.status.Store(503)
	if got := h.request(); got != 503 {
		t.Fatalf("after rejection, an outage must not fall back to the old session: got %d want 503", got)
	}
}
