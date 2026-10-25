// Command progress-service tracks which lessons each learner has completed.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const schema = `
CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id      UUID        NOT NULL,
    lesson_id    BIGINT      NOT NULL,
    topic_slug   VARCHAR(100) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user_topic ON lesson_progress(user_id, topic_slug);`

type ctxKey struct{}

type server struct {
	db        *pgxpool.Pool
	secret    []byte
	readyURLs []string
	client    *http.Client
}

type progressItem struct {
	LessonID    int64     `json:"lessonId"`
	TopicSlug   string    `json:"topicSlug"`
	CompletedAt time.Time `json:"completedAt"`
}

func main() {
	ctx := context.Background()
	db, err := connect(ctx, env("DATABASE_URL", "postgres://sarvaikam:sarvaikam@localhost:5432/sarvaikam?sslmode=disable"))
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()
	if _, err := db.Exec(ctx, schema); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	s := &server{
		db:        db,
		secret:    []byte(env("JWT_SECRET", "change-me-to-a-long-random-secret-of-32-bytes-min")),
		readyURLs: splitList(os.Getenv("READY_URLS")),
		client:    &http.Client{Timeout: 2 * time.Second},
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Route("/api/progress", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "UP"}) })
		r.Get("/ready", s.ready)
		r.Group(func(r chi.Router) {
			r.Use(s.auth)
			r.Get("/me", s.listMine)
			r.Get("/me/topics/{topicSlug}", s.topicProgress)
			r.Post("/lessons/{lessonId}/complete", s.complete)
			r.Delete("/lessons/{lessonId}/complete", s.uncomplete)
		})
	})

	addr := ":" + env("PORT", "8083")
	log.Printf("progress-service listening on %s", addr)
	srv := &http.Server{Addr: addr, Handler: r, ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(srv.ListenAndServe())
}

// connect retries so the service tolerates Postgres starting slowly in k8s.
func connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	var lastErr error
	for i := 0; i < 15; i++ {
		db, err := pgxpool.New(ctx, url)
		if err == nil {
			if err = db.Ping(ctx); err == nil {
				return db, nil
			}
			db.Close()
		}
		lastErr = err
		time.Sleep(2 * time.Second)
	}
	return nil, lastErr
}

func (s *server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			writeErr(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		tok, err := jwt.Parse(raw, func(t *jwt.Token) (any, error) { return s.secret, nil },
			jwt.WithValidMethods([]string{"HS256"}))
		if err != nil || !tok.Valid {
			writeErr(w, http.StatusUnauthorized, "invalid token")
			return
		}
		sub, err := tok.Claims.GetSubject()
		if err != nil || sub == "" {
			writeErr(w, http.StatusUnauthorized, "invalid token subject")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, sub)))
	})
}

func userID(r *http.Request) string { return r.Context().Value(ctxKey{}).(string) }

func (s *server) listMine(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(),
		`SELECT lesson_id, topic_slug, completed_at FROM lesson_progress WHERE user_id = $1 ORDER BY completed_at DESC`,
		userID(r))
	if err != nil {
		writeErr(w, 500, "query failed")
		return
	}
	defer rows.Close()
	items := []progressItem{}
	for rows.Next() {
		var p progressItem
		if err := rows.Scan(&p.LessonID, &p.TopicSlug, &p.CompletedAt); err != nil {
			writeErr(w, 500, "scan failed")
			return
		}
		items = append(items, p)
	}
	writeJSON(w, 200, items)
}

func (s *server) topicProgress(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(),
		`SELECT lesson_id FROM lesson_progress WHERE user_id = $1 AND topic_slug = $2`,
		userID(r), chi.URLParam(r, "topicSlug"))
	if err != nil {
		writeErr(w, 500, "query failed")
		return
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			writeErr(w, 500, "scan failed")
			return
		}
		ids = append(ids, id)
	}
	writeJSON(w, 200, map[string]any{"topicSlug": chi.URLParam(r, "topicSlug"), "completedLessonIds": ids})
}

func (s *server) complete(w http.ResponseWriter, r *http.Request) {
	id, err := lessonID(r)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	var body struct {
		TopicSlug string `json:"topicSlug"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || body.TopicSlug == "" {
		writeErr(w, 400, "topicSlug is required")
		return
	}
	_, err = s.db.Exec(r.Context(),
		`INSERT INTO lesson_progress (user_id, lesson_id, topic_slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		userID(r), id, body.TopicSlug)
	if err != nil {
		writeErr(w, 500, "insert failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) uncomplete(w http.ResponseWriter, r *http.Request) {
	id, err := lessonID(r)
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	if _, err := s.db.Exec(r.Context(),
		`DELETE FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2`, userID(r), id); err != nil {
		writeErr(w, 500, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func lessonID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, "lessonId"), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid lessonId")
	}
	return id, nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ready reports 200 only when the database and every URL in READY_URLS (the sibling services in the
// all-in-one image) respond; used as the Kubernetes readiness probe via nginx /ready.
func (s *server) ready(w http.ResponseWriter, r *http.Request) {
	checks := map[string]string{}
	ok := true
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		checks["database"], ok = "down", false
	} else {
		checks["database"] = "up"
	}
	for _, u := range s.readyURLs {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err == nil {
			var res *http.Response
			if res, err = s.client.Do(req); err == nil {
				res.Body.Close()
				if res.StatusCode != http.StatusOK {
					err = errors.New(res.Status)
				}
			}
		}
		if err != nil {
			checks[u], ok = "down", false
		} else {
			checks[u] = "up"
		}
	}
	status := http.StatusOK
	if !ok {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{"ready": ok, "checks": checks})
}

func splitList(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
