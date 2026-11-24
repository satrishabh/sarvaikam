package com.sarvaikam.content.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Validates HS256 JWTs issued by auth-service; claims: sub (user id), email, role. */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    static final java.util.regex.Pattern PLACEHOLDER =
            java.util.regex.Pattern.compile("change-?me|example|placeholder", java.util.regex.Pattern.CASE_INSENSITIVE);
    private final SecretKey key;
    private final RestClient sessions;
    private final SessionCache cache;
    private final Breaker breaker;

    public record SessionUser(String id, String role, List<String> permissions) {}

    /**
     * Remembers each user's /me answer briefly so auth-service isn't called on every request. Answers younger than
     * {@code fresh} are used directly (suspensions apply within that window); while auth-service is unreachable or
     * returns 5xx, answers younger than {@code stale} keep learners working. Rejections are never cached.
     */
    static final class SessionCache {
        private record Entry(SessionUser user, long fetchedAtMillis) {}
        private final java.util.concurrent.ConcurrentHashMap<String, Entry> entries = new java.util.concurrent.ConcurrentHashMap<>();
        private final long freshMillis;
        private final long staleMillis;
        private final int maxEntries;
        java.util.function.LongSupplier clock = System::currentTimeMillis;

        SessionCache(Duration fresh, Duration stale, int maxEntries) {
            this.freshMillis = fresh.toMillis();
            this.staleMillis = Math.max(stale.toMillis(), freshMillis);
            this.maxEntries = maxEntries;
        }

        SessionUser fresh(String sub) { return within(sub, freshMillis); }
        SessionUser stale(String sub) { return within(sub, staleMillis); }

        private SessionUser within(String sub, long maxAgeMillis) {
            if (freshMillis <= 0) return null;
            Entry e = entries.get(sub);
            return e != null && clock.getAsLong() - e.fetchedAtMillis() < maxAgeMillis ? e.user() : null;
        }

        void store(String sub, SessionUser user) {
            if (freshMillis <= 0) return;
            long now = clock.getAsLong();
            if (entries.size() >= maxEntries) {
                entries.values().removeIf(e -> now - e.fetchedAtMillis() >= staleMillis);
                if (entries.size() >= maxEntries) entries.clear();
            }
            entries.put(sub, new Entry(user, now));
        }

        void forget(String sub) { entries.remove(sub); }
    }

    /**
     * Stops calling auth-service while it is down, so cache misses fail in microseconds instead of each waiting out
     * the connect and read timeouts. Opens after {@code threshold} failures in a row; after {@code cooldown} one
     * trial call is let through (half-open), and its result closes or re-opens the breaker. Starting a trial pushes
     * the next one a cooldown away, so a trial that never reports back cannot leave the breaker stuck.
     */
    static final class Breaker {
        private final int threshold;
        private final long cooldownMillis;
        private int failures;
        private long openUntilMillis;
        java.util.function.LongSupplier clock = System::currentTimeMillis;

        Breaker(int threshold, Duration cooldown) {
            this.threshold = Math.max(1, threshold);
            this.cooldownMillis = cooldown.toMillis();
        }

        /** True when a call may go to auth-service now. */
        synchronized boolean allow() {
            if (failures < threshold) return true;
            long now = clock.getAsLong();
            if (now < openUntilMillis) return false;
            openUntilMillis = now + cooldownMillis;
            return true;
        }

        synchronized void succeeded() { failures = 0; }

        synchronized void failed() {
            if (++failures >= threshold) openUntilMillis = clock.getAsLong() + cooldownMillis;
        }

        synchronized boolean open() { return failures >= threshold; }
    }

    public JwtAuthFilter(@Value("${app.jwt-secret}") String secret,
                         @Value("${AUTH_SERVICE_URL:http://localhost:8082}") String authUrl,
                         @Value("${APP_ENV:prod}") String appEnv,
                         @Value("${SESSION_CACHE_TTL_SECONDS:30}") long cacheTtlSeconds,
                         @Value("${SESSION_CACHE_STALE_SECONDS:300}") long cacheStaleSeconds) {
        this.cache = new SessionCache(Duration.ofSeconds(cacheTtlSeconds), Duration.ofSeconds(cacheStaleSeconds), 10_000);
        this.breaker = new Breaker(5, Duration.ofSeconds(10));
        // Published placeholder values are public knowledge; outside dev they would let anyone mint tokens.
        if (!"dev".equals(appEnv) && PLACEHOLDER.matcher(secret).find())
            throw new IllegalStateException("JWT_SECRET is a published placeholder value; generate one with: openssl rand -base64 48");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.sessions = RestClient.builder().baseUrl(authUrl).requestFactory(factory).build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = Jwts.parser().verifyWith(key).build()
                        .parseSignedClaims(header.substring(7)).getPayload();
                // Read current authorization: suspension and policy changes apply to existing sessions
                // (within the short cache window; see SessionCache).
                String sub = claims.getSubject();
                SessionUser user = cache.fresh(sub);
                if (user == null) {
                    SessionUser fetched = null;
                    boolean unavailable = false;
                    if (!breaker.allow()) {
                        unavailable = true;
                    } else {
                        try {
                            fetched = sessions.get().uri("/api/auth/me").header("Authorization", header)
                                    .retrieve().body(SessionUser.class);
                            breaker.succeeded();
                        } catch (HttpClientErrorException rejected) {
                            breaker.succeeded(); // auth-service answered; the session is what failed
                            cache.forget(sub);
                            throw new IllegalArgumentException("Session rejected", rejected);
                        } catch (RestClientException down) { // network errors and 5xx
                            breaker.failed();
                            unavailable = true;
                        }
                    }
                    if (unavailable) {
                        // Not re-stored: the stale answer must age out even if the outage continues.
                        user = cache.stale(sub);
                        if (user == null) {
                            // Fail closed and say so: silently downgrading a signed-in learner to anonymous hides
                            // their exclusive lessons and looks like lost access. The client retries a 503.
                            SecurityContextHolder.clearContext();
                            res.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                            res.setHeader("Retry-After", "5");
                            res.setContentType("application/json");
                            res.getWriter().write("{\"message\":\"Account services are briefly unavailable. Try again in a moment.\"}");
                            return;
                        }
                    } else {
                        if (fetched == null || !sub.equals(fetched.id()) || fetched.permissions() == null) {
                            cache.forget(sub);
                            throw new IllegalArgumentException("Session unavailable");
                        }
                        cache.store(sub, fetched);
                        user = fetched;
                    }
                }
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + user.role()));
                user.permissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p)));
                var auth = new UsernamePasswordAuthenticationToken(claims.getSubject(), null,
                        authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (RuntimeException ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(req, res);
    }
}
