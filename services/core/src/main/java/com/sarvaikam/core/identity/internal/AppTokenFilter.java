package com.sarvaikam.core.identity.internal;

import com.sarvaikam.core.identity.CurrentUser;
import com.sarvaikam.core.platform.ApiErrors;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Accepts the HS256 app JWT that auth-service issues (5-minute lifetime), then confirms the account with
 * auth-service. A request without a bearer header continues anonymously and the access rules decide.
 */
class AppTokenFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AppTokenFilter.class);
    static final Pattern PLACEHOLDER = Pattern.compile("change-?me|example|placeholder", Pattern.CASE_INSENSITIVE);

    private final SecretKey key;
    private final AccountDirectory accounts;

    AppTokenFilter(String secret, String appEnv, AccountDirectory accounts) {
        if (secret == null || secret.length() < 32)
            throw new IllegalStateException("JWT_SECRET must be set to at least 32 characters");
        // Published placeholder values are public knowledge; outside dev they would let anyone mint tokens.
        if (!"dev".equals(appEnv) && PLACEHOLDER.matcher(secret).find())
            throw new IllegalStateException("JWT_SECRET is a published placeholder value; generate one with: openssl rand -base64 48");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accounts = accounts;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String path = req.getRequestURI();
        return path.endsWith("/health") || path.endsWith("/ready");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }
        String subject;
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(header.substring(7)).getPayload();
            subject = claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            ApiErrors.write(res, 401, "invalid token");
            return;
        }
        if (subject == null || subject.isBlank()) {
            ApiErrors.write(res, 401, "invalid token subject");
            return;
        }
        AccountDirectory.Account account;
        try {
            account = accounts.current(header);
        } catch (AccountDirectory.Unavailable e) {
            // Fail closed, and say it is temporary: the client retries a 503 instead of signing the learner out.
            log.warn("session validation unavailable: {}", e.getMessage());
            res.setHeader("Retry-After", "5");
            ApiErrors.write(res, 503, "session validation unavailable");
            return;
        }
        if (account == null || !subject.equals(account.id())) {
            ApiErrors.write(res, 401, "account unavailable");
            return;
        }
        var user = new CurrentUser(subject, Set.copyOf(account.permissions()), header);
        var authorities = account.permissions().stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, authorities));
        try {
            chain.doFilter(req, res);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
