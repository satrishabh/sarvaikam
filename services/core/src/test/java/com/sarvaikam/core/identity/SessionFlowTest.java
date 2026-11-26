package com.sarvaikam.core.identity;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.io.IOException;
import java.net.CookieManager;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sign-in on the Keycloak login page, end to end over real HTTP and cookies. Keycloak and auth-service are stubs;
 * the stub Keycloak signs real RS256 ID tokens and checks the PKCE verifier.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class SessionFlowTest {
    static final String CLIENT_ID = "sarvaikam-learn-web";
    static final String SECRET = "test-secret-of-at-least-32-characters-long";

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

    static final RSAKey key = generateKey();
    static final HttpServer stub = startStub();
    static final String issuer = "http://127.0.0.1:" + stub.getAddress().getPort() + "/realms/test";

    /** Stub behaviour and what it was asked. */
    static final Map<String, String> challenges = new HashMap<>(); // code -> PKCE challenge
    static final Map<String, String> nonces = new HashMap<>();     // code -> nonce
    static volatile int accessExpiresIn = 300;
    static volatile boolean refreshRejected = false;
    static volatile boolean keycloakDown = false;
    static volatile int tokenGeneration = 0;
    static final List<String> exchanged = new CopyOnWriteArrayList<>();
    static final List<String> revoked = new CopyOnWriteArrayList<>();
    static final List<String> adminLogouts = new CopyOnWriteArrayList<>();

    @LocalServerPort int port;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        String base = "http://127.0.0.1:" + stub.getAddress().getPort();
        registry.add("PROFILE_ISSUER", () -> issuer);
        registry.add("PROFILE_WEB_CLIENT_ID", () -> CLIENT_ID);
        registry.add("PROFILE_WEB_CLIENT_SECRET", () -> "web-secret");
        registry.add("PROFILE_REGISTRATION_CLIENT_SECRET", () -> "admin-secret");
        registry.add("AUTH_SERVICE_URL", () -> base);
        registry.add("CONTENT_SERVICE_URL", () -> base);
        registry.add("app.jwt-secret", () -> SECRET);
        registry.add("APP_ENV", () -> "dev");
    }

    @BeforeEach
    void reset() {
        accessExpiresIn = 300;
        refreshRejected = false;
        keycloakDown = false;
        exchanged.clear();
        revoked.clear();
        adminLogouts.clear();
    }

    @AfterAll
    static void stop() { stub.stop(0); }

    // ------------------------------------------------------------------ the browser

    final class Browser {
        final HttpClient http = HttpClient.newBuilder().cookieHandler(new CookieManager())
                .followRedirects(HttpClient.Redirect.NEVER).build();

        HttpResponse<String> get(String path, String... headers) throws Exception {
            var b = HttpRequest.newBuilder(URI.create(path.startsWith("http") ? path : "http://localhost:" + port + path)).GET();
            for (int i = 0; i < headers.length; i += 2) b.header(headers[i], headers[i + 1]);
            return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        }

        HttpResponse<String> post(String path, String... headers) throws Exception {
            var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).POST(HttpRequest.BodyPublishers.noBody());
            for (int i = 0; i < headers.length; i += 2) b.header(headers[i], headers[i + 1]);
            return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        }

        HttpResponse<String> session() throws Exception { return get("/api/session", "X-Sarvaikam-Client", "web"); }

        /** Starts sign-in and returns Keycloak's authorization URL. */
        URI startSignIn(String entry) throws Exception {
            var start = get(entry);
            assertThat(start.statusCode()).isEqualTo(302);
            var authorize = get(start.headers().firstValue("Location").orElseThrow());
            assertThat(authorize.statusCode()).isEqualTo(302);
            return URI.create(authorize.headers().firstValue("Location").orElseThrow());
        }

        /** Plays the user signing in on Keycloak and returns where the Core finally sends the browser. */
        String signIn(String returnTo) throws Exception {
            URI keycloak = startSignIn("/api/session/login?returnTo=" + java.net.URLEncoder.encode(returnTo, StandardCharsets.UTF_8));
            Map<String, String> q = query(keycloak.getRawQuery());
            String code = "code-" + UUID.randomUUID();
            synchronized (challenges) {
                challenges.put(code, q.get("code_challenge"));
                nonces.put(code, q.get("nonce"));
            }
            var callback = get(q.get("redirect_uri") + "?code=" + code + "&state=" + q.get("state"));
            assertThat(callback.statusCode()).isEqualTo(302);
            // The container may make the redirect absolute; it must then stay on this site.
            String location = callback.headers().firstValue("Location").orElseThrow();
            String origin = "http://localhost:" + port;
            if (location.startsWith("http")) {
                assertThat(location).startsWith(origin + "/");
                location = location.substring(origin.length());
            }
            return location;
        }
    }

    // ------------------------------------------------------------------ tests

    @Test
    void theAppIsToldToUseKeycloak() throws Exception {
        assertThat(new Browser().get("/api/session/options").body()).contains("\"signIn\":\"keycloak\"");
    }

    @Test
    void signInUsesAuthorizationCodeWithPkceAndReturnsToThePage() throws Exception {
        var browser = new Browser();
        URI keycloak = browser.startSignIn("/api/session/login?returnTo=/topics/java");
        assertThat(keycloak.toString()).startsWith(issuer + "/protocol/openid-connect/auth?");
        Map<String, String> q = query(keycloak.getRawQuery());
        assertThat(q).containsEntry("response_type", "code").containsEntry("client_id", CLIENT_ID)
                .containsEntry("code_challenge_method", "S256").containsKeys("state", "nonce", "code_challenge");
        assertThat(q.get("redirect_uri")).endsWith("/api/session/callback/profile");

        var fresh = new Browser();
        assertThat(fresh.signIn("/topics/java")).isEqualTo("/topics/java");
        var session = fresh.session();
        assertThat(session.statusCode()).isEqualTo(200);
        assertThat(session.body()).contains("\"token\":\"app-token\"");
        assertThat(exchanged).last().asString().startsWith("Bearer kc-access-");
        // The session cookie carries no token, and Keycloak tokens are never in a response body.
        assertThat(session.body()).doesNotContain("kc-access").doesNotContain("kc-refresh");
    }

    @Test
    void theSessionNeedsTheClientHeaderAndASignIn() throws Exception {
        var browser = new Browser();
        assertThat(browser.get("/api/session").statusCode()).isEqualTo(403);
        assertThat(browser.session().statusCode()).isEqualTo(401);
        browser.signIn("/");
        assertThat(browser.get("/api/session").statusCode()).isEqualTo(403);
        assertThat(browser.post("/api/session/logout").statusCode()).isEqualTo(403);
    }

    @Test
    void signUpOpensKeycloakRegistrationPage() throws Exception {
        URI keycloak = new Browser().startSignIn("/api/session/register?returnTo=/paths");
        assertThat(keycloak.getPath()).endsWith("/protocol/openid-connect/registrations");
        assertThat(query(keycloak.getRawQuery())).containsKeys("state", "nonce", "code_challenge");
    }

    @Test
    void returnToCannotLeaveTheSite() throws Exception {
        for (String target : List.of("//evil.example", "https://evil.example/", "/\\evil.example", "topics")) {
            assertThat(new Browser().signIn(target)).as(target).isEqualTo("/");
        }
    }

    @Test
    void expiredKeycloakTokensAreRefreshedServerSide() throws Exception {
        accessExpiresIn = 30; // inside the 60-second clock skew, so every use refreshes
        var browser = new Browser();
        browser.signIn("/");
        assertThat(browser.session().statusCode()).isEqualTo(200);
        String first = exchanged.getLast();
        assertThat(browser.session().statusCode()).isEqualTo(200);
        assertThat(exchanged.getLast()).isNotEqualTo(first);
    }

    @Test
    void aKeycloakOutageKeepsTheSession() throws Exception {
        accessExpiresIn = 30;
        var browser = new Browser();
        browser.signIn("/");
        keycloakDown = true;
        var during = browser.session();
        assertThat(during.statusCode()).isEqualTo(503);
        assertThat(during.headers().firstValue("Retry-After")).contains("5");
        keycloakDown = false;
        assertThat(browser.session().statusCode()).isEqualTo(200);
    }

    @Test
    void aRejectedRefreshEndsTheSession() throws Exception {
        accessExpiresIn = 30;
        var browser = new Browser();
        browser.signIn("/");
        refreshRejected = true;
        assertThat(browser.session().statusCode()).isEqualTo(401);
        refreshRejected = false;
        assertThat(browser.session().statusCode()).isEqualTo(401); // the session is gone
    }

    @Test
    void signOutRevokesTheKeycloakSessionAndEndsThisOne() throws Exception {
        var browser = new Browser();
        browser.signIn("/");
        var out = browser.post("/api/session/logout", "X-Sarvaikam-Client", "web");
        assertThat(out.statusCode()).isEqualTo(200);
        assertThat(out.body()).contains("\"revoked\":true");
        assertThat(revoked).singleElement().asString().startsWith("kc-refresh-");
        assertThat(browser.session().statusCode()).isEqualTo(401);
        // Signing out when already signed out still succeeds.
        assertThat(browser.post("/api/session/logout", "X-Sarvaikam-Client", "web").statusCode()).isEqualTo(200);
    }

    @Test
    void signOutEverywhereEndsEveryBrowsersSession() throws Exception {
        var laptop = new Browser();
        var phone = new Browser();
        laptop.signIn("/");
        phone.signIn("/");
        assertThat(phone.session().statusCode()).isEqualTo(200);

        var out = laptop.post("/api/session/logout-all", "X-Sarvaikam-Client", "web");
        assertThat(out.statusCode()).isEqualTo(200);
        assertThat(adminLogouts).containsExactly("kc-sub-1");
        assertThat(laptop.session().statusCode()).isEqualTo(401);
        assertThat(phone.session().statusCode()).isEqualTo(401);
    }

    // ------------------------------------------------------------------ stub Keycloak and auth-service

    static RSAKey generateKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("test-key").generate();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static HttpServer startStub() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/realms/test/protocol/openid-connect/certs", ex ->
                    reply(ex, 200, new JWKSet(key.toPublicJWK()).toString()));
            server.createContext("/realms/test/protocol/openid-connect/token", SessionFlowTest::token);
            server.createContext("/realms/test/protocol/openid-connect/logout", ex -> {
                revoked.add(query(body(ex)).get("refresh_token"));
                reply(ex, 204, "");
            });
            server.createContext("/admin/realms/test/users/", ex -> {
                String[] parts = ex.getRequestURI().getPath().split("/");
                if (!"Bearer admin-token".equals(ex.getRequestHeaders().getFirst("Authorization"))) { reply(ex, 401, "{}"); return; }
                adminLogouts.add(parts[parts.length - 2]);
                reply(ex, 204, "");
            });
            server.createContext("/api/auth/oidc/exchange", ex -> {
                exchanged.add(ex.getRequestHeaders().getFirst("Authorization"));
                reply(ex, 200, "{\"token\":\"app-token\",\"user\":{\"id\":\"11111111-1111-1111-1111-111111111111\",\"name\":\"Asha\"}}");
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    static void token(HttpExchange ex) throws IOException {
        Map<String, String> form = query(body(ex));
        String basic = ex.getRequestHeaders().getFirst("Authorization");
        if ("client_credentials".equals(form.get("grant_type"))) {
            reply(ex, 200, "{\"access_token\":\"admin-token\",\"token_type\":\"Bearer\",\"expires_in\":60}");
            return;
        }
        String expected = "Basic " + Base64.getEncoder().encodeToString((CLIENT_ID + ":web-secret").getBytes(StandardCharsets.UTF_8));
        if (!expected.equals(basic)) { reply(ex, 401, "{\"error\":\"invalid_client\"}"); return; }
        String nonce = null;
        if ("authorization_code".equals(form.get("grant_type"))) {
            String code = form.get("code");
            String challenge;
            synchronized (challenges) {
                challenge = challenges.remove(code);
                nonce = nonces.remove(code);
            }
            if (challenge == null || !challenge.equals(s256(form.get("code_verifier")))) {
                reply(ex, 400, "{\"error\":\"invalid_grant\",\"error_description\":\"PKCE verification failed\"}");
                return;
            }
        } else if ("refresh_token".equals(form.get("grant_type"))) {
            if (keycloakDown) { reply(ex, 502, "<html>bad gateway</html>"); return; }
            if (refreshRejected) { reply(ex, 400, "{\"error\":\"invalid_grant\"}"); return; }
        } else {
            reply(ex, 400, "{\"error\":\"unsupported_grant_type\"}");
            return;
        }
        int n = ++tokenGeneration;
        String idToken = idToken(nonce);
        reply(ex, 200, "{\"access_token\":\"kc-access-" + n + "\",\"refresh_token\":\"kc-refresh-" + n + "\",\"token_type\":\"Bearer\","
                + "\"expires_in\":" + accessExpiresIn + ",\"scope\":\"openid email profile\""
                + (idToken == null ? "" : ",\"id_token\":\"" + idToken + "\"") + "}");
    }

    static String idToken(String nonce) {
        if (nonce == null) return null; // refresh responses here carry no ID token
        try {
            var claims = new JWTClaimsSet.Builder().issuer(issuer).subject("kc-sub-1").audience(CLIENT_ID)
                    .claim("azp", CLIENT_ID).claim("nonce", nonce).claim("email", "asha@example.com")
                    .issueTime(new Date()).expirationTime(Date.from(Instant.now().plusSeconds(300))).build();
            var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
            jwt.sign(new RSASSASigner(key));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String s256(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            return "";
        }
    }

    static String body(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    static Map<String, String> query(String raw) {
        Map<String, String> out = new HashMap<>();
        if (raw == null || raw.isEmpty()) return out;
        for (String pair : raw.split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8), kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
        }
        return out;
    }

    static void reply(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, status == 204 ? -1 : bytes.length);
        if (status != 204) ex.getResponseBody().write(bytes);
        ex.close();
    }
}
