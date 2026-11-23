package com.sarvaikam.content.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SessionCacheTest {
    private final JwtAuthFilter.SessionUser person = new JwtAuthFilter.SessionUser("person", "USER", List.of("assets.download"));
    private long now = 1_800_000_000_000L;

    private JwtAuthFilter.SessionCache cache(int maxEntries) {
        var cache = new JwtAuthFilter.SessionCache(Duration.ofSeconds(30), Duration.ofMinutes(5), maxEntries);
        cache.clock = () -> now;
        return cache;
    }

    @Test
    void freshWithinTtlThenOnlyStale() {
        var cache = cache(10);
        cache.store("person", person);
        assertEquals(person, cache.fresh("person"));
        now += 31_000;
        assertNull(cache.fresh("person"), "past the TTL auth-service must be asked again");
        assertEquals(person, cache.stale("person"), "usable while auth-service is down");
        now += 5 * 60_000;
        assertNull(cache.stale("person"), "stale answers age out");
    }

    @Test
    void forgottenSessionsAreNeverServed() {
        var cache = cache(10);
        cache.store("person", person);
        cache.forget("person");
        assertNull(cache.fresh("person"));
        assertNull(cache.stale("person"));
    }

    @Test
    void zeroTtlDisablesCaching() {
        var cache = new JwtAuthFilter.SessionCache(Duration.ZERO, Duration.ofMinutes(5), 10);
        cache.store("person", person);
        assertNull(cache.fresh("person"));
        assertNull(cache.stale("person"));
    }

    @Test
    void staysWithinItsSizeBound() {
        var cache = cache(2);
        cache.store("a", person);
        cache.store("b", person);
        cache.store("c", person);
        assertEquals(person, cache.fresh("c"));
        assertNull(cache.fresh("a"), "full cache is cleared rather than growing without bound");
    }
}
