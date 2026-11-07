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
import org.springframework.web.client.RestClient;

/** Validates HS256 JWTs issued by auth-service; claims: sub (user id), email, role. */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final SecretKey key;
    private final RestClient sessions;

    public record SessionUser(String id, String role, List<String> permissions) {}

    public JwtAuthFilter(@Value("${app.jwt-secret}") String secret,
                         @Value("${AUTH_SERVICE_URL:http://localhost:8082}") String authUrl) {
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
                // Read current authorization: suspension and policy changes apply to existing sessions.
                SessionUser user = sessions.get().uri("/api/auth/me").header("Authorization", header)
                        .retrieve().body(SessionUser.class);
                if (user == null || !claims.getSubject().equals(user.id()) || user.permissions() == null)
                    throw new IllegalArgumentException("Session unavailable");
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
