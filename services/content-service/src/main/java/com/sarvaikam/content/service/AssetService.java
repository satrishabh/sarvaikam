package com.sarvaikam.content.service;

import com.google.cloud.storage.*;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ImpersonatedCredentials;
import com.sarvaikam.content.domain.Lesson;
import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.security.ContentAccess;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class AssetService {
    public record UploadRequest(@NotBlank @Size(max = 200) String filename,
                                @NotBlank @Pattern(regexp = "application/pdf|application/zip|application/octet-stream|video/mp4|video/webm|text/plain") String contentType,
                                @Min(1) long size) {}
    public record AssetView(UUID id, String filename, String contentType, long size) {}
    public record UploadView(UUID id, String url, Map<String, String> headers, int expiresInSeconds) {}
    public record DownloadView(String url, int expiresInSeconds) {}
    private record Asset(UUID id, long lessonId, String objectName, String filename, String contentType, long size, Long generation, boolean ready) {}

    private final JdbcTemplate db;
    private final LessonRepository lessons;
    private final String bucket;
    private final long maxSize;
    private Storage storage;
    private final String signingAccount;

    public AssetService(JdbcTemplate db, LessonRepository lessons,
                        @Value("${GCP_CONTENT_BUCKET:}") String bucket,
                        @Value("${GCP_MAX_UPLOAD_BYTES:2147483648}") long maxSize,
                        @Value("${GCP_SIGNING_SERVICE_ACCOUNT:}") String signingAccount) {
        this.db = db; this.lessons = lessons; this.bucket = bucket; this.maxSize = maxSize; this.signingAccount = signingAccount;
    }

    synchronized Storage storage() {
        if (bucket.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured yet");
        if (storage == null) {
            try {
                var options = StorageOptions.newBuilder();
                if (!signingAccount.isBlank()) options.setCredentials(ImpersonatedCredentials.create(
                        GoogleCredentials.getApplicationDefault(), signingAccount, null,
                        List.of("https://www.googleapis.com/auth/devstorage.read_write"), 300));
                storage = options.build().getService();
            } catch (java.io.IOException e) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage credentials are unavailable");
            }
        }
        return storage;
    }

    private Lesson lesson(long id) {
        return lessons.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
    }

    public List<AssetView> list(long lessonId) {
        ContentAccess.lesson(lesson(lessonId).isExclusive());
        return db.query("SELECT id, filename, content_type, expected_size FROM lesson_assets WHERE lesson_id = ? AND ready = true ORDER BY created_at",
                (rs, n) -> new AssetView(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4)), lessonId);
    }

    public UploadView upload(long lessonId, UploadRequest request) {
        ContentAccess.require("content.manage");
        lesson(lessonId);
        if (request.size() > maxSize) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds the configured upload limit");
        String filename = request.filename().trim();
        if (filename.isBlank() || filename.chars().anyMatch(c -> c == '/' || c == '\\' || Character.isISOControl(c)) || filename.equals(".") || filename.equals(".."))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a filename without paths or control characters");
        UUID id = UUID.randomUUID();
        String object = "lessons/" + lessonId + "/" + id;
        BlobInfo info = BlobInfo.newBuilder(bucket, object).setContentType(request.contentType()).build();
        String url = storage().signUrl(info, 15, TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(com.google.cloud.storage.HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(), Storage.SignUrlOption.withContentType(),
                Storage.SignUrlOption.withExtHeaders(Map.of("content-length", Long.toString(request.size()), "content-type", request.contentType())),
                Storage.SignUrlOption.withQueryParams(Map.of("ifGenerationMatch", "0"))).toString();
        db.update("INSERT INTO lesson_assets(id, lesson_id, object_name, filename, content_type, expected_size) VALUES (?, ?, ?, ?, ?, ?)",
                id, lessonId, object, filename, request.contentType(), request.size());
        return new UploadView(id, url, Map.of("Content-Type", request.contentType()), 900);
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
        Blob blob = storage().get(bucket, a.objectName());
        if (blob == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Upload has not completed. Retry the upload.");
        if (blob.getSize() != a.size() || blob.getSize() > maxSize || !a.contentType().equals(blob.getContentType())) {
            storage().delete(blob.getBlobId());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size or type did not match the upload. Upload it again.");
        }
        db.update("UPDATE lesson_assets SET ready = true, generation = ? WHERE id = ?", blob.getGeneration(), id);
        return new AssetView(id, a.filename(), a.contentType(), a.size());
    }

    public DownloadView download(UUID id) {
        ContentAccess.require("assets.download");
        Asset a = asset(id);
        ContentAccess.lesson(lesson(a.lessonId()).isExclusive());
        if (!a.ready()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File is not ready");
        String safeName = a.filename().replaceAll("[^a-zA-Z0-9._ -]", "_");
        String url = storage().signUrl(BlobInfo.newBuilder(bucket, a.objectName()).build(), 5, TimeUnit.MINUTES,
                Storage.SignUrlOption.withV4Signature(), Storage.SignUrlOption.withQueryParams(Map.of(
                        "generation", Long.toString(a.generation()), "response-content-disposition", "attachment; filename=\"" + safeName + "\""))).toString();
        return new DownloadView(url, 300);
    }

    public void delete(UUID id) {
        ContentAccess.require("content.manage");
        Asset a = asset(id);
        storage().delete(BlobId.of(bucket, a.objectName()));
        db.update("DELETE FROM lesson_assets WHERE id = ?", id);
    }

    public void deleteForLesson(long lessonId) {
        for (UUID id : db.query("SELECT id FROM lesson_assets WHERE lesson_id = ?", (rs, n) -> rs.getObject(1, UUID.class), lessonId)) delete(id);
    }
}
