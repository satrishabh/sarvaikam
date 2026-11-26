package main

import (
	"sync"
	"time"
)

// sessionCache remembers each user's current permissions from auth-service /me for a short time, so
// auth-service is not called on every request and a brief auth-service outage doesn't sign everyone out.
//
//   - fresh: answers younger than this are used without calling auth-service (suspensions and permission
//     changes therefore apply within this window).
//   - stale: when auth-service is unreachable or returns 5xx, answers younger than this are still used.
//
// A rejected session (4xx, wrong subject, bad body) is removed immediately and never served from cache.
// A nil *sessionCache disables caching.
type sessionCache struct {
	mu         sync.Mutex
	freshFor   time.Duration
	staleFor   time.Duration
	maxEntries int
	entries    map[string]cachedSession
	now        func() time.Time
}

type cachedSession struct {
	permissions []string
	fetched     time.Time
}

func newSessionCache(fresh, stale time.Duration, maxEntries int) *sessionCache {
	if fresh <= 0 {
		return nil
	}
	if stale < fresh {
		stale = fresh
	}
	return &sessionCache{freshFor: fresh, staleFor: stale, maxEntries: maxEntries,
		entries: map[string]cachedSession{}, now: time.Now}
}

func (c *sessionCache) lookup(sub string, maxAge time.Duration) ([]string, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[sub]
	if !ok || c.now().Sub(e.fetched) >= maxAge {
		return nil, false
	}
	return e.permissions, true
}

// fresh returns permissions that may be used without asking auth-service.
func (c *sessionCache) fresh(sub string) ([]string, bool) {
	if c == nil {
		return nil, false
	}
	return c.lookup(sub, c.freshFor)
}

// stale returns permissions that may be used while auth-service is unavailable.
func (c *sessionCache) stale(sub string) ([]string, bool) {
	if c == nil {
		return nil, false
	}
	return c.lookup(sub, c.staleFor)
}

func (c *sessionCache) store(sub string, permissions []string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if len(c.entries) >= c.maxEntries {
		for k, e := range c.entries {
			if now.Sub(e.fetched) >= c.staleFor {
				delete(c.entries, k)
			}
		}
		if len(c.entries) >= c.maxEntries {
			c.entries = map[string]cachedSession{}
		}
	}
	c.entries[sub] = cachedSession{permissions: permissions, fetched: now}
}

func (c *sessionCache) forget(sub string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, sub)
}
