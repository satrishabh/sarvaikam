package com.sarvaikam.core.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ready when the database and every URL in READY_URLS answer. In the all-in-one image READY_URLS lists the sibling
 * processes, and the image's /ready (its Kubernetes readiness probe) points here.
 */
@Component
public class Readiness {
    public record Report(boolean ready, Map<String, String> checks) {}

    private final JdbcClient db;
    private final List<String> urls;
    private final RestClient http;

    public Readiness(JdbcClient db, @Value("${READY_URLS:}") String readyUrls) {
        this.db = db;
        this.urls = Arrays.stream(readyUrls.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(2));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public Report check() {
        Map<String, String> checks = new LinkedHashMap<>();
        boolean ok = true;
        try {
            db.sql("SELECT 1").query(Integer.class).single();
            checks.put("database", "up");
        } catch (RuntimeException e) {
            checks.put("database", "down");
            ok = false;
        }
        for (String url : urls) {
            boolean up;
            try {
                up = Boolean.TRUE.equals(http.get().uri(url).exchange((req, res) -> res.getStatusCode().value() == 200));
            } catch (RuntimeException e) {
                up = false;
            }
            checks.put(url, up ? "up" : "down");
            ok &= up;
        }
        return new Report(ok, checks);
    }
}
