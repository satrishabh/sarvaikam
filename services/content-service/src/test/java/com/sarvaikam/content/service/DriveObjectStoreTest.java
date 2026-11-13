package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.Lesson;
import com.sarvaikam.content.domain.LessonRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Runs DriveObjectStore against a small in-process fake of the OAuth token and Drive v3 endpoints. */
class DriveObjectStoreTest {
    private HttpServer server;
    private URI base;
    private final Map<String, Map<String, String>> files = new LinkedHashMap<>(); // id -> key, mime, size, version, parent
    private final Map<String, byte[]> contents = new HashMap<>();
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private final AtomicInteger ids = new AtomicInteger();
    private String lastUploadOrigin;

    @BeforeEach void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/token", this::token);
        server.createContext("/drive/files", this::drive);
        server.createContext("/upload/files", this::upload);
        server.createContext("/session/", this::session);
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/");
    }

    @AfterEach void stop() { server.stop(0); SecurityContextHolder.clearContext(); }

    private DriveObjectStore store() {
        return new DriveObjectStore("client", "secret", "refresh", "", "Sarvaikam content",
                base.resolve("token"), base.resolve("drive/"), base.resolve("upload/"));
    }

    @Test void createReadStatAndDeleteRoundTripInsideTheAppFolder() {
        var store = store();
        store.create("lesson-bodies/a.md", "# Hello".getBytes(StandardCharsets.UTF_8), "text/markdown; charset=utf-8");
        assertEquals("# Hello", new String(store.read("lesson-bodies/a.md"), StandardCharsets.UTF_8));
        var stat = store.stat("lesson-bodies/a.md");
        assertEquals(7, stat.size());
        assertEquals("text/markdown; charset=utf-8", stat.contentType());
        String folder = files.values().stream().filter(f -> DriveObjectStore.FOLDER_MIME.equals(f.get("mime"))).findFirst().orElseThrow().get("id");
        assertEquals(folder, files.values().stream().filter(f -> "lesson-bodies/a.md".equals(f.get("key"))).findFirst().orElseThrow().get("parent"));
        assertThrows(ResponseStatusException.class, () -> store.create("lesson-bodies/a.md", new byte[]{1}, "text/plain"));
        store.delete("lesson-bodies/a.md");
        assertNull(store.read("lesson-bodies/a.md"));
        assertEquals(1, tokenCalls.get(), "access token is cached between calls");
    }

    @Test void folderIsReusedAcrossInstances() {
        store().create("x/1", new byte[]{1}, "text/plain");
        store().create("x/2", new byte[]{2}, "text/plain");
        assertEquals(1, files.values().stream().filter(f -> DriveObjectStore.FOLDER_MIME.equals(f.get("mime"))).count());
    }

    @Test void resumableUploadForwardsBrowserOriginAndCompletesThroughAssetService() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", null,
                List.of(new SimpleGrantedAuthority("content.manage"), new SimpleGrantedAuthority("assets.download"))));
        var lessons = mock(LessonRepository.class);
        when(lessons.findById(1L)).thenReturn(Optional.of(new Lesson()));
        var db = mock(JdbcTemplate.class);
        var store = store();
        var service = new AssetService(db, lessons, store, 100, "test-secret-test-secret-test-secret-1234", "/api/content");

        var ticket = service.upload(1, new AssetService.UploadRequest("guide.pdf", "application/pdf", 4), "https://learn.example");
        assertEquals("https://learn.example", lastUploadOrigin);
        assertTrue(ticket.url().contains("/session/"), ticket.url());
        var put = java.net.http.HttpRequest.newBuilder(URI.create(ticket.url())).PUT(java.net.http.HttpRequest.BodyPublishers.ofByteArray(new byte[]{1, 2, 3, 4})).build();
        assertEquals(200, java.net.http.HttpClient.newHttpClient().send(put, java.net.http.HttpResponse.BodyHandlers.discarding()).statusCode());

        Object[] row = {ticket.id(), 1L, "lessons/1/" + ticket.id(), "guide.pdf", "application/pdf", 4L, null, false};
        when(db.query(startsWith("SELECT id, lesson_id"), any(RowMapper.class), eq(ticket.id()))).thenAnswer(inv -> {
            var rs = mock(java.sql.ResultSet.class);
            when(rs.getObject(1, UUID.class)).thenReturn((UUID) row[0]);
            when(rs.getLong(2)).thenReturn((Long) row[1]);
            when(rs.getString(3)).thenReturn((String) row[2]);
            when(rs.getString(4)).thenReturn((String) row[3]);
            when(rs.getString(5)).thenReturn((String) row[4]);
            when(rs.getLong(6)).thenReturn((Long) row[5]);
            when(rs.getObject(7)).thenReturn(row[6]);
            when(rs.getBoolean(8)).thenReturn((Boolean) row[7]);
            return List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 0));
        });
        service.complete(ticket.id());
        verify(db).update(startsWith("UPDATE lesson_assets SET ready = true"), eq(1L), eq(ticket.id()));

        row[6] = 1L; row[7] = true;
        var download = service.download(ticket.id());
        assertTrue(download.url().startsWith("/api/content/assets/" + ticket.id() + "/file?expires="), download.url());
        Matcher m = Pattern.compile("expires=(\\d+)&signature=([0-9a-f]+)").matcher(download.url());
        assertTrue(m.find());
        try (var file = service.stream(ticket.id(), Long.parseLong(m.group(1)), m.group(2)).body()) {
            assertArrayEquals(new byte[]{1, 2, 3, 4}, file.readAllBytes());
        }
        assertThrows(ResponseStatusException.class, () -> service.stream(ticket.id(), Long.parseLong(m.group(1)), "00" + m.group(2).substring(2)));
        long past = Instant.now().getEpochSecond() - 1;
        assertThrows(ResponseStatusException.class, () -> service.stream(ticket.id(), past, service.sign(ticket.id(), past)));
    }

    @Test void unconfiguredDriveIsDisabled() {
        assertFalse(new DriveObjectStore("", "", "", "", "x").enabled());
    }

    // ------------------------------------------------------------------ fake Google endpoints

    private void token(HttpExchange ex) throws IOException {
        String form = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (!form.contains("grant_type=refresh_token") || !form.contains("refresh_token=refresh")) { reply(ex, 400, "{}"); return; }
        tokenCalls.incrementAndGet();
        reply(ex, 200, "{\"access_token\":\"at\",\"expires_in\":3600}");
    }

    private boolean authorized(HttpExchange ex) throws IOException {
        if ("Bearer at".equals(ex.getRequestHeaders().getFirst("Authorization"))) return true;
        reply(ex, 401, "{}");
        return false;
    }

    private void drive(HttpExchange ex) throws IOException {
        if (!authorized(ex)) return;
        String path = ex.getRequestURI().getPath().substring("/drive/files".length());
        String query = Optional.ofNullable(ex.getRequestURI().getRawQuery()).orElse("");
        if (path.isEmpty() && "GET".equals(ex.getRequestMethod())) {
            String q = param(query, "q");
            var hits = files.values().stream().filter(f -> matches(f, q)).map(this::json).toList();
            reply(ex, 200, "{\"files\":[" + String.join(",", hits) + "]}");
        } else if (path.isEmpty() && "POST".equals(ex.getRequestMethod())) {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String id = add(body, null);
            reply(ex, 200, "{\"id\":\"" + id + "\"}");
        } else if ("DELETE".equals(ex.getRequestMethod())) {
            files.remove(path.substring(1)); ex.sendResponseHeaders(204, -1); ex.close();
        } else if (query.contains("alt=media")) {
            byte[] data = contents.get(path.substring(1));
            if (data == null) { reply(ex, 404, "{}"); return; }
            ex.sendResponseHeaders(200, data.length); ex.getResponseBody().write(data); ex.close();
        } else reply(ex, 400, "{}");
    }

    private void upload(HttpExchange ex) throws IOException {
        if (!authorized(ex)) return;
        String query = ex.getRequestURI().getRawQuery();
        byte[] raw = ex.getRequestBody().readAllBytes();
        if (query.contains("uploadType=resumable")) {
            lastUploadOrigin = ex.getRequestHeaders().getFirst("Origin");
            String id = add(new String(raw, StandardCharsets.UTF_8), null);
            files.get(id).remove("size");
            ex.getResponseHeaders().add("Location", base.resolve("session/" + id).toString());
            ex.sendResponseHeaders(200, -1); ex.close();
        } else {
            String body = new String(raw, StandardCharsets.ISO_8859_1);
            String boundary = ex.getRequestHeaders().getFirst("Content-Type").replaceFirst(".*boundary=", "");
            String[] parts = body.split("--" + Pattern.quote(boundary));
            String meta = parts[1].substring(parts[1].indexOf("\r\n\r\n") + 4).trim();
            String media = parts[2].substring(parts[2].indexOf("\r\n\r\n") + 4);
            media = media.substring(0, media.length() - 2);
            String id = add(meta, media.getBytes(StandardCharsets.ISO_8859_1));
            reply(ex, 200, "{\"id\":\"" + id + "\"}");
        }
    }

    private void session(HttpExchange ex) throws IOException {
        String id = ex.getRequestURI().getPath().substring("/session/".length());
        byte[] data = ex.getRequestBody().readAllBytes();
        contents.put(id, data);
        files.get(id).put("size", Integer.toString(data.length));
        files.get(id).put("version", "1");
        reply(ex, 200, "{\"id\":\"" + id + "\"}");
    }

    private String add(String meta, byte[] data) {
        String id = "f" + ids.incrementAndGet();
        var f = new HashMap<String, String>();
        f.put("id", id);
        f.put("mime", field(meta, "mimeType"));
        f.put("key", field(meta, "sarvaikamKey"));
        Matcher parent = Pattern.compile("\"parents\"\\s*:\\s*\\[\"([^\"]+)\"").matcher(meta);
        if (parent.find()) f.put("parent", parent.group(1));
        if (data != null) { contents.put(id, data); f.put("size", Integer.toString(data.length)); }
        f.put("version", "1");
        files.put(id, f);
        return id;
    }

    private boolean matches(Map<String, String> f, String q) {
        Matcher key = Pattern.compile("value='([^']*)'").matcher(q);
        if (!key.find() || !key.group(1).equals(f.get("key"))) return false;
        Matcher parent = Pattern.compile("^'([^']*)' in parents").matcher(q);
        if (parent.find() && !parent.group(1).equals(f.get("parent"))) return false;
        return !q.contains("mimeType='") || DriveObjectStore.FOLDER_MIME.equals(f.get("mime"));
    }

    private String json(Map<String, String> f) {
        return "{\"id\":\"" + f.get("id") + "\",\"mimeType\":\"" + f.get("mime") + "\",\"version\":\"" + f.get("version") + "\""
                + (f.containsKey("size") ? ",\"size\":\"" + f.get("size") + "\"" : "") + "}";
    }

    private static String field(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String param(String query, String name) {
        for (String p : query.split("&")) if (p.startsWith(name + "=")) return URLDecoder.decode(p.substring(name.length() + 1), StandardCharsets.UTF_8);
        return "";
    }

    private static void reply(HttpExchange ex, int status, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(status, b.length); ex.getResponseBody().write(b); ex.close();
    }
}
