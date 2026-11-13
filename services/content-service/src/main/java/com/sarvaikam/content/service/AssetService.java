package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.Lesson;
import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.security.ContentAccess;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class AssetService {
    public record UploadRequest(@NotBlank @Size(max = 200) String filename,
                                @NotBlank @Pattern(regexp = "application/pdf|application/zip|application/octet-stream|video/mp4|video/webm|text/plain") String contentType,
                                @Min(1) long size) {}
    public record AssetView(UUID id, String filename, String contentType, long size) {}
    public record UploadView(UUID id, String url, Map<String, String> headers, int expiresInSeconds) {}
    public record DownloadView(String url, int expiresInSeconds) {}
    public record FileStream(String filename, String contentType, long size, InputStream body) {}
    private record Asset(UUID id, long lessonId, String objectName, String filename, String contentType, long size, Long generation, boolean ready) {}

    static final int DOWNLOAD_SECONDS = 300;
    private final JdbcTemplate db;
    private final LessonRepository lessons;
    private final ObjectStore store;
    private final long maxSize;
    private final byte[] linkKey;
    private final String contextPath;

    public AssetService(JdbcTemplate db, LessonRepository lessons, ObjectStore store,
                        @Value("${GCP_MAX_UPLOAD_BYTES:2147483648}") long maxSize,
                        @Value("${app.jwt-secret}") String linkSecret,
                        @Value("${server.servlet.context-path:}") String contextPath) {
        this.db = db; this.lessons = lessons; this.store = store; this.maxSize = maxSize;
        this.linkKey = ("asset-download:" + linkSecret).getBytes(StandardCharsets.UTF_8);
        this.contextPath = contextPath;
    }

    private Lesson lesson(long id) {
        return lessons.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
    }

    public List<AssetView> list(long lessonId) {
        ContentAccess.lesson(lesson(lessonId).isExclusive());
        return db.query("SELECT id, filename, content_type, expected_size FROM lesson_assets WHERE lesson_id = ? AND ready = true ORDER BY created_at",
                (rs, n) -> new AssetView(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4)), lessonId);
    }

    public UploadView upload(long lessonId, UploadRequest request) { return upload(lessonId, request, null); }

    public UploadView upload(long lessonId, UploadRequest request, String origin) {
        ContentAccess.require("content.manage");
        lesson(lessonId);
        if (request.size() > maxSize) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds the configured upload limit");
        String filename = request.filename().trim();
        if (filename.isBlank() || filename.chars().anyMatch(c -> c == '/' || c == '\\' || Character.isISOControl(c)) || filename.equals(".") || filename.equals(".."))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a filename without paths or control characters");
        UUID id = UUID.randomUUID();
        String object = "lessons/" + lessonId + "/" + id;
        var ticket = store.uploadTicket(object, request.contentType(), request.size(), origin);
        db.update("INSERT INTO lesson_assets(id, lesson_id, object_name, filename, content_type, expected_size) VALUES (?, ?, ?, ?, ?, ?)",
                id, lessonId, object, filename, request.contentType(), request.size());
        return new UploadView(id, ticket.url(), ticket.headers(), 900);
    }

    private Asset asset(UUID id) {
        var found = db.query("SELECT id, lesson_id, object_name, filename, content_type, expected_size, generation, ready FROM lesson_assets WHERE id = ?",
                (rs, n) -> new Asset(rs.getObject(1, UUID.class), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getLong(6), (Long) rs.getObject(7), rs.getBoolean(8)), id);
        if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        return found.getFirst();
    }

    public AssetView complete(UUID id) {
        ContentAccess.require("content.manage");
        Asset a = asset(id);
        var stored = store.stat(a.objectName());
        if (stored == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Upload has not completed. Retry the upload.");
        if (stored.size() != a.size() || stored.size() > maxSize || !a.contentType().equals(stored.contentType())) {
            store.delete(a.objectName());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size or type did not match the upload. Upload it again.");
        }
        db.update("UPDATE lesson_assets SET ready = true, generation = ? WHERE id = ?", stored.version(), id);
        return new AssetView(id, a.filename(), a.contentType(), a.size());
    }

    private static String safeName(String filename) { return filename.replaceAll("[^a-zA-Z0-9._ -]", "_"); }

    public DownloadView download(UUID id) {
        ContentAccess.require("assets.download");
        Asset a = asset(id);
        ContentAccess.lesson(lesson(a.lessonId()).isExclusive());
        if (!a.ready()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File is not ready");
        String url = store.directDownloadUrl(a.objectName(), a.generation(), safeName(a.filename()));
        if (url == null) {
            long expires = Instant.now().getEpochSecond() + DOWNLOAD_SECONDS;
            url = contextPath + "/assets/" + id + "/file?expires=" + expires + "&signature=" + sign(id, expires);
        }
        return new DownloadView(url, DOWNLOAD_SECONDS);
    }

    /** Serves a download link issued by {@link #download}; the signature carries the access check made then. */
    public FileStream stream(UUID id, long expires, String signature) throws IOException {
        if (expires < Instant.now().getEpochSecond() || expires > Instant.now().getEpochSecond() + DOWNLOAD_SECONDS
                || signature == null || !MessageDigest.isEqual(sign(id, expires).getBytes(StandardCharsets.US_ASCII), signature.getBytes(StandardCharsets.US_ASCII)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This download link has expired. Start the download again.");
        Asset a = asset(id);
        if (!a.ready()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File is not ready");
        return new FileStream(safeName(a.filename()), a.contentType(), a.size(), store.open(a.objectName(), a.generation()));
    }

    String sign(UUID id, long expires) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(linkKey, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((id + ":" + expires).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public void delete(UUID id) {
        ContentAccess.require("content.manage");
        Asset a = asset(id);
        store.delete(a.objectName());
        db.update("DELETE FROM lesson_assets WHERE id = ?", id);
    }

    public void deleteForLesson(long lessonId) {
        for (UUID id : db.query("SELECT id FROM lesson_assets WHERE lesson_id = ?", (rs, n) -> rs.getObject(1, UUID.class), lessonId)) delete(id);
    }
}
