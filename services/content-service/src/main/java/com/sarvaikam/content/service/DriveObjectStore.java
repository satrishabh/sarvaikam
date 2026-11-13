package com.sarvaikam.content.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Google Drive (personal account) through the Drive v3 REST API.
 *
 * Authenticates as the Drive owner with an OAuth refresh token limited to the drive.file scope, so the
 * service only sees files it created. Objects live in one app-created folder; each file carries its
 * storage key in appProperties. Drive has no signed download URLs, so downloads stream through the service.
 */
public class DriveObjectStore implements ObjectStore {
    static final String FOLDER_MIME = "application/vnd.google-apps.folder";
    private static final String KEY_PROPERTY = "sarvaikamKey";

    private final String clientId, clientSecret, refreshToken, folderName;
    private final URI tokenUrl, apiBase, uploadBase;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NORMAL).build();
    private final ObjectMapper json = new ObjectMapper();
    private String folderId;
    private String accessToken;
    private Instant accessTokenExpiry = Instant.EPOCH;

    public DriveObjectStore(String clientId, String clientSecret, String refreshToken, String folderId, String folderName) {
        this(clientId, clientSecret, refreshToken, folderId, folderName,
                URI.create("https://oauth2.googleapis.com/token"), URI.create("https://www.googleapis.com/drive/v3/"),
                URI.create("https://www.googleapis.com/upload/drive/v3/"));
    }

    DriveObjectStore(String clientId, String clientSecret, String refreshToken, String folderId, String folderName,
                     URI tokenUrl, URI apiBase, URI uploadBase) {
        this.clientId = clientId; this.clientSecret = clientSecret; this.refreshToken = refreshToken;
        this.folderId = folderId == null || folderId.isBlank() ? null : folderId;
        this.folderName = folderName; this.tokenUrl = tokenUrl; this.apiBase = apiBase; this.uploadBase = uploadBase;
    }

    public boolean enabled() { return !clientId.isBlank() && !clientSecret.isBlank() && !refreshToken.isBlank(); }

    // ------------------------------------------------------------------ auth

    private synchronized String token() {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google Drive storage is not configured yet");
        if (accessToken != null && Instant.now().isBefore(accessTokenExpiry)) return accessToken;
        String form = "grant_type=refresh_token&client_id=" + enc(clientId) + "&client_secret=" + enc(clientSecret) + "&refresh_token=" + enc(refreshToken);
        JsonNode body = sendJson(HttpRequest.newBuilder(tokenUrl).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)), false);
        accessToken = body.path("access_token").asString();
        accessTokenExpiry = Instant.now().plusSeconds(Math.max(60, body.path("expires_in").asLong(3600) - 120));
        return accessToken;
    }

    private HttpRequest.Builder api(String pathAndQuery) {
        return HttpRequest.newBuilder(apiBase.resolve(pathAndQuery)).timeout(Duration.ofSeconds(30)).header("Authorization", "Bearer " + token());
    }

    private synchronized String folder() {
        if (folderId != null) return folderId;
        String q = "mimeType='" + FOLDER_MIME + "' and appProperties has { key='" + KEY_PROPERTY + "' and value='root' } and trashed=false";
        JsonNode found = sendJson(api("files?fields=files(id)&spaces=drive&q=" + enc(q)).GET(), true);
        if (found.path("files").size() > 0) return folderId = found.path("files").get(0).path("id").asString();
        var meta = Map.of("name", folderName, "mimeType", FOLDER_MIME, "appProperties", Map.of(KEY_PROPERTY, "root"));
        JsonNode created = sendJson(api("files?fields=id").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(meta))), true);
        return folderId = created.path("id").asString();
    }

    // ------------------------------------------------------------------ objects

    private JsonNode find(String key) {
        String q = "'" + quote(folder()) + "' in parents and appProperties has { key='" + KEY_PROPERTY + "' and value='" + quote(key) + "' } and trashed=false";
        JsonNode files = sendJson(api("files?fields=files(id,size,mimeType,version)&spaces=drive&q=" + enc(q)).GET(), true).path("files");
        return files.size() == 0 ? null : files.get(0);
    }

    private Map<String, Object> metadata(String key, String contentType) {
        var meta = new LinkedHashMap<String, Object>();
        meta.put("name", key.replace('/', '_'));
        meta.put("mimeType", contentType);
        meta.put("parents", java.util.List.of(folder()));
        meta.put("appProperties", Map.of(KEY_PROPERTY, key));
        return meta;
    }

    public void create(String key, byte[] data, String contentType) {
        if (find(key) != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Stored object already exists");
        String boundary = "sarvaikam" + java.util.UUID.randomUUID();
        byte[] head = ("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + json.writeValueAsString(metadata(key, contentType))
                + "\r\n--" + boundary + "\r\nContent-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--").getBytes(StandardCharsets.UTF_8);
        var body = HttpRequest.BodyPublishers.concat(HttpRequest.BodyPublishers.ofByteArray(head),
                HttpRequest.BodyPublishers.ofByteArray(data), HttpRequest.BodyPublishers.ofByteArray(tail));
        sendJson(HttpRequest.newBuilder(uploadBase.resolve("files?uploadType=multipart&fields=id")).timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + token()).header("Content-Type", "multipart/related; boundary=" + boundary).POST(body), true);
    }

    public byte[] read(String key) {
        JsonNode file = find(key);
        if (file == null) return null;
        HttpResponse<byte[]> r = send(api("files/" + enc(file.path("id").asString()) + "?alt=media").GET(), HttpResponse.BodyHandlers.ofByteArray());
        if (r.statusCode() == 404) return null;
        check(r.statusCode());
        return r.body();
    }

    public Stat stat(String key) {
        JsonNode file = find(key);
        if (file == null || !file.hasNonNull("size")) return null;
        return new Stat(file.path("size").asLong(), file.path("mimeType").asString(), file.path("version").asLong());
    }

    public void delete(String key) {
        JsonNode file = find(key);
        if (file == null) return;
        HttpResponse<Void> r = send(api("files/" + enc(file.path("id").asString())).DELETE(), HttpResponse.BodyHandlers.discarding());
        if (r.statusCode() != 404) check(r.statusCode());
    }

    /** Starts a resumable session; the returned session URI accepts one PUT of the file from the browser origin. */
    public UploadTicket uploadTicket(String key, String contentType, long size, String origin) {
        if (find(key) != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Stored object already exists");
        var request = HttpRequest.newBuilder(uploadBase.resolve("files?uploadType=resumable&fields=id")).timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token()).header("Content-Type", "application/json; charset=UTF-8")
                .header("X-Upload-Content-Type", contentType).header("X-Upload-Content-Length", Long.toString(size))
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(metadata(key, contentType))));
        // Drive only answers the browser's cross-origin PUT when the session was opened for that origin.
        if (origin != null && !origin.isBlank()) request.header("Origin", origin);
        HttpResponse<Void> r = send(request, HttpResponse.BodyHandlers.discarding());
        check(r.statusCode());
        String session = r.headers().firstValue("Location").orElseThrow(() ->
                new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Drive did not return an upload session"));
        return new UploadTicket(session, Map.of("Content-Type", contentType));
    }

    public String directDownloadUrl(String key, long version, String filename) { return null; }

    public InputStream open(String key, long version) throws IOException {
        JsonNode file = find(key);
        if (file == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        if (file.path("version").asLong() != version) throw new ResponseStatusException(HttpStatus.CONFLICT, "File changed since it was uploaded");
        HttpResponse<InputStream> r = send(HttpRequest.newBuilder(apiBase.resolve("files/" + enc(file.path("id").asString()) + "?alt=media"))
                .header("Authorization", "Bearer " + token()).GET(), HttpResponse.BodyHandlers.ofInputStream());
        if (r.statusCode() / 100 != 2) { r.body().close(); check(r.statusCode()); }
        return r.body();
    }

    // ------------------------------------------------------------------ http

    private <T> HttpResponse<T> send(HttpRequest.Builder request, HttpResponse.BodyHandler<T> handler) {
        try {
            return http.send(request.build(), handler);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Drive is unreachable");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google Drive request was interrupted");
        }
    }

    private JsonNode sendJson(HttpRequest.Builder request, boolean authorized) {
        HttpResponse<String> r = send(request, HttpResponse.BodyHandlers.ofString());
        if (!authorized && r.statusCode() / 100 != 2)
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google Drive authorization failed; re-run the Drive authorization script");
        check(r.statusCode());
        return json.readTree(r.body().isEmpty() ? "{}" : r.body());
    }

    private static void check(int status) {
        if (status / 100 == 2) return;
        if (status == 401 || status == 403) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google Drive rejected the request (" + status + ")");
        if (status == 429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Google Drive rate limit reached; try again shortly");
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Google Drive request failed (" + status + ")");
    }

    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String quote(String value) { return value.replace("\\", "\\\\").replace("'", "\\'"); }
}
