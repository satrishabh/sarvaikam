package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheckLessonAccessRejectsInvalidTopicBeforeCallingContent(t *testing.T) {
	calls := 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(200)
	}))
	defer upstream.Close()
	t.Setenv("CONTENT_SERVICE_URL", upstream.URL)
	s := &server{client: upstream.Client()}
	for _, body := range []string{`{"topicSlug":"Bad Slug"}`, `{"topicSlug":""}`, `not json`} {
		req := httptest.NewRequest("PUT", "/", strings.NewReader(body))
		response := httptest.NewRecorder()
		if _, ok := s.checkLessonAccess(response, req, 1); ok || response.Code != 400 {
			t.Fatalf("body %q: ok=%v status=%d, want rejected with 400", body, ok, response.Code)
		}
	}
	if calls != 0 {
		t.Fatalf("content service was called %d times for invalid input", calls)
	}
}

func TestCheckLessonAccessForwardsCallerAndMapsContentDecisions(t *testing.T) {
	for _, scenario := range []struct {
		name       string
		upstream   int
		wantOK     bool
		wantStatus int
	}{
		{"allowed", 200, true, 200},
		{"lesson not in topic", 404, false, 404},
		{"no access", 403, false, 403},
		{"content unavailable", 500, false, 503},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer token" {
					t.Error("caller token was not forwarded")
				}
				if r.URL.Query().Get("topicSlug") != "java-basics" {
					t.Errorf("topicSlug = %q", r.URL.Query().Get("topicSlug"))
				}
				w.WriteHeader(scenario.upstream)
			}))
			defer upstream.Close()
			t.Setenv("CONTENT_SERVICE_URL", upstream.URL)
			s := &server{client: upstream.Client()}
			req := httptest.NewRequest("PUT", "/", strings.NewReader(`{"topicSlug":"java-basics"}`))
			req.Header.Set("Authorization", "Bearer token")
			response := httptest.NewRecorder()
			slug, ok := s.checkLessonAccess(response, req, 7)
			if ok != scenario.wantOK {
				t.Fatalf("ok = %v, want %v", ok, scenario.wantOK)
			}
			if ok && slug != "java-basics" {
				t.Fatalf("slug = %q", slug)
			}
			if !ok && response.Code != scenario.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, scenario.wantStatus)
			}
		})
	}
}

func TestBookmarkRejectsInvalidLessonIdWithoutDatabase(t *testing.T) {
	s := &server{}
	for _, handler := range []http.HandlerFunc{s.bookmark, s.unbookmark} {
		req := httptest.NewRequest("PUT", "/", nil)
		response := httptest.NewRecorder()
		handler(response, req)
		if response.Code != 400 {
			t.Fatalf("status = %d, want 400", response.Code)
		}
	}
}
