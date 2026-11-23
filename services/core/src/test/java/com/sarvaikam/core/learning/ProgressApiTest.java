package com.sarvaikam.core.learning;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The Core's /api/progress against a real PostgreSQL, with auth-service and content-service stubbed. Mirrors the
 * progress-service tests so both implementations answer the same way while the gateway moves traffic.
 */
@SpringBootTest
@AutoConfigureMockMvc
@RecordApplicationEvents
@Testcontainers(disabledWithoutDocker = true)
class ProgressApiTest {
    static final String SECRET = "test-secret-of-at-least-32-characters-long";

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

    /** What the stubbed services answer, and what they were asked. */
    static volatile int meStatus = 200;
    static volatile String meBody = null; // null: echo the caller's subject with the permissions below
    static volatile String permissions = "[]";
    static volatile int accessStatus = 200;
    static final List<String> accessCalls = new CopyOnWriteArrayList<>();
    static final HttpServer upstream = start();

    @Autowired MockMvc mvc;
    @Autowired ApplicationEvents events;

    String user;
    String token;

    static HttpServer start() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/auth/me", ex -> {
                String auth = ex.getRequestHeaders().getFirst("Authorization");
                String subject = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).build()
                        .parseSignedClaims(auth.substring(7)).getPayload().getSubject();
                String body = meBody != null ? meBody : "{\"id\":\"" + subject + "\",\"role\":\"USER\",\"permissions\":" + permissions + "}";
                reply(ex, meStatus, body);
            });
            server.createContext("/api/content/lessons/", ex -> {
                accessCalls.add(ex.getRequestURI() + " " + ex.getRequestHeaders().getFirst("Authorization"));
                reply(ex, accessStatus, "{}");
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    static void reply(com.sun.net.httpserver.HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.close();
    }

    @AfterAll
    static void stop() { upstream.stop(0); }

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + upstream.getAddress().getPort();
        registry.add("AUTH_SERVICE_URL", () -> base);
        registry.add("CONTENT_SERVICE_URL", () -> base);
        registry.add("app.jwt-secret", () -> SECRET);
        registry.add("APP_ENV", () -> "dev");
    }

    @BeforeEach
    void reset() {
        meStatus = 200;
        meBody = null;
        permissions = "[]";
        accessStatus = 200;
        accessCalls.clear();
        user = UUID.randomUUID().toString();
        token = tokenFor(user);
    }

    static String tokenFor(String subject) {
        return Jwts.builder().subject(subject).claim("role", "ADMIN")
                .expiration(java.util.Date.from(Instant.now().plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token);
    }

    MockHttpServletRequestBuilder topic(MockHttpServletRequestBuilder request, String body) {
        return as(request).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void healthIsPublicAndEverythingElseNeedsASession() throws Exception {
        mvc.perform(get("/api/progress/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/api/progress/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("missing bearer token"));
        mvc.perform(get("/api/somewhere-else").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test
    void everyResponseCarriesARequestId() throws Exception {
        mvc.perform(get("/api/progress/health")).andExpect(header().exists("X-Request-Id"));
        mvc.perform(get("/api/progress/health").header("X-Request-Id", "trace-abc-123"))
                .andExpect(header().string("X-Request-Id", "trace-abc-123"));
    }

    @Test
    void completingALessonRecordsItOnceAndPublishesOneEvent() throws Exception {
        mvc.perform(topic(post("/api/progress/lessons/7/complete"), "{\"topicSlug\":\"java-basics\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(topic(post("/api/progress/lessons/7/complete"), "{\"topicSlug\":\"java-basics\"}"))
                .andExpect(status().isNoContent());

        assertThat(events.stream(LessonCompleted.class)).singleElement()
                .satisfies(e -> {
                    assertThat(e.userId()).isEqualTo(user);
                    assertThat(e.lessonId()).isEqualTo(7);
                    assertThat(e.topicSlug()).isEqualTo("java-basics");
                });
        assertThat(accessCalls).allMatch(call ->
                call.startsWith("/api/content/lessons/7/access?topicSlug=java-basics ") && call.endsWith("Bearer " + token));

        mvc.perform(as(get("/api/progress/me"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].lessonId").value(7))
                .andExpect(jsonPath("$[0].topicSlug").value("java-basics"))
                .andExpect(jsonPath("$[0].completedAt").isString());
        mvc.perform(as(get("/api/progress/me/topics/java-basics"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.topicSlug").value("java-basics"))
                .andExpect(jsonPath("$.completedLessonIds[0]").value(7));

        mvc.perform(as(delete("/api/progress/lessons/7/complete"))).andExpect(status().isNoContent());
        mvc.perform(as(delete("/api/progress/lessons/7/complete"))).andExpect(status().isNoContent());
        assertThat(events.stream(LessonReopened.class)).hasSize(1);
        mvc.perform(as(get("/api/progress/me"))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void invalidInputIsRejectedBeforeContentIsAsked() throws Exception {
        for (String body : List.of("{\"topicSlug\":\"Bad Slug\"}", "{\"topicSlug\":\"\"}", "not json", "{\"topicSlug\":7}",
                "{\"topicSlug\":\"" + "a".repeat(5000) + "\"}")) {
            mvc.perform(topic(put("/api/progress/lessons/1/bookmark"), body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("topicSlug is required"));
        }
        mvc.perform(topic(post("/api/progress/lessons/abc/complete"), "{\"topicSlug\":\"java\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid lessonId"));
        mvc.perform(topic(post("/api/progress/lessons/0/complete"), "{\"topicSlug\":\"java\"}")).andExpect(status().isBadRequest());
        assertThat(accessCalls).isEmpty();
    }

    @Test
    void contentDecisionsPassThroughAndContentFailuresAre503() throws Exception {
        for (int[] scenario : new int[][]{{404, 404}, {403, 403}, {401, 401}, {400, 400}, {500, 503}, {302, 503}}) {
            accessStatus = scenario[0];
            mvc.perform(topic(put("/api/progress/lessons/3/bookmark"), "{\"topicSlug\":\"java\"}"))
                    .andExpect(status().is(scenario[1]));
        }
        mvc.perform(as(get("/api/progress/me/bookmarks"))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void bookmarksAreSavedListedAndRemoved() throws Exception {
        mvc.perform(topic(put("/api/progress/lessons/3/bookmark"), "{\"topicSlug\":\"java\"}")).andExpect(status().isNoContent());
        mvc.perform(topic(put("/api/progress/lessons/3/bookmark"), "{\"topicSlug\":\"java\"}")).andExpect(status().isNoContent());
        mvc.perform(as(get("/api/progress/me/bookmarks"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].lessonId").value(3))
                .andExpect(jsonPath("$[0].createdAt").isString());
        mvc.perform(as(delete("/api/progress/lessons/3/bookmark"))).andExpect(status().isNoContent());
        mvc.perform(as(get("/api/progress/me/bookmarks"))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void theCurrentAccountNotTheTokenDecides() throws Exception {
        meStatus = 401;
        mvc.perform(as(get("/api/progress/me"))).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("account unavailable"));

        meStatus = 200;
        meBody = "{\"id\":\"someone-else\",\"permissions\":[]}";
        mvc.perform(as(get("/api/progress/me"))).andExpect(status().isUnauthorized());

        meBody = "{";
        mvc.perform(as(get("/api/progress/me"))).andExpect(status().isUnauthorized());

        meBody = null;
        mvc.perform(get("/api/progress/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("invalid token"));
        String forged = Jwts.builder().subject(user)
                .signWith(Keys.hmacShaKeyFor("another-secret-of-at-least-32-characters".getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
        mvc.perform(get("/api/progress/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
    }

    @Test
    void anAccountServiceOutageIsTemporaryNotASignOut() throws Exception {
        meStatus = 500;
        mvc.perform(as(get("/api/progress/me"))).andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Retry-After", "5"));
    }

    @Test
    void candidateProgressNeedsTheCurrentPermission() throws Exception {
        String candidate = UUID.randomUUID().toString();
        mvc.perform(as(get("/api/progress/users/" + candidate))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("candidate access is required"));
        permissions = "[\"candidates.view\"]";
        mvc.perform(as(get("/api/progress/users/" + candidate))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(as(get("/api/progress/users/not-a-uuid"))).andExpect(status().isBadRequest());
    }
}
