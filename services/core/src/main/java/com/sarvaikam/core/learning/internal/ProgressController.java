package com.sarvaikam.core.learning.internal;

import com.sarvaikam.core.identity.CurrentUser;
import com.sarvaikam.core.platform.ApiErrors;
import com.sarvaikam.core.platform.Readiness;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The progress-service API, path for path and status for status, so the gateway can switch {@code /api/progress}
 * between the two implementations.
 */
@RestController
@RequestMapping("/api/progress")
class ProgressController {
    static final int MAX_BODY_BYTES = 4096;
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern USER_ID =
            Pattern.compile("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$");

    private final ProgressStore store;
    private final Progress progress;
    private final LessonAccess access;
    private final Readiness readiness;
    private final JsonMapper json;

    ProgressController(ProgressStore store, Progress progress, LessonAccess access, Readiness readiness, JsonMapper json) {
        this.store = store;
        this.progress = progress;
        this.access = access;
        this.readiness = readiness;
        this.json = json;
    }

    @GetMapping("/health")
    Map<String, String> health() { return Map.of("status", "UP"); }

    @GetMapping("/ready")
    ResponseEntity<Readiness.Report> ready() {
        var report = readiness.check();
        return ResponseEntity.status(report.ready() ? 200 : 503).body(report);
    }

    @GetMapping("/me")
    ResponseEntity<?> mine() {
        UUID user = caller();
        return user == null ? badSubject() : ResponseEntity.ok(store.progress(user));
    }

    @GetMapping("/users/{userId}")
    ResponseEntity<?> user(@PathVariable String userId) {
        if (!CurrentUser.require().can("candidates.view")) return ApiErrors.body(403, "candidate access is required");
        if (!USER_ID.matcher(userId).matches()) return ApiErrors.body(400, "invalid user ID");
        return ResponseEntity.ok(store.progress(UUID.fromString(userId)));
    }

    @GetMapping("/me/topics/{topicSlug}")
    ResponseEntity<?> topic(@PathVariable String topicSlug) {
        UUID user = caller();
        if (user == null) return badSubject();
        return ResponseEntity.ok(Map.of("topicSlug", topicSlug, "completedLessonIds", store.completedInTopic(user, topicSlug)));
    }

    @PostMapping("/lessons/{lessonId}/complete")
    ResponseEntity<?> complete(@PathVariable String lessonId, HttpServletRequest req) throws IOException {
        return withLesson(lessonId, req, (user, id, slug) -> progress.complete(user, id, slug));
    }

    @DeleteMapping("/lessons/{lessonId}/complete")
    ResponseEntity<?> uncomplete(@PathVariable String lessonId) {
        long id = lessonId(lessonId);
        if (id <= 0) return ApiErrors.body(400, "invalid lessonId");
        UUID user = caller();
        if (user == null) return badSubject();
        progress.uncomplete(user, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/bookmarks")
    ResponseEntity<?> bookmarks() {
        UUID user = caller();
        return user == null ? badSubject() : ResponseEntity.ok(store.bookmarks(user));
    }

    @PutMapping("/lessons/{lessonId}/bookmark")
    ResponseEntity<?> bookmark(@PathVariable String lessonId, HttpServletRequest req) throws IOException {
        return withLesson(lessonId, req, store::bookmark);
    }

    @DeleteMapping("/lessons/{lessonId}/bookmark")
    ResponseEntity<?> unbookmark(@PathVariable String lessonId) {
        long id = lessonId(lessonId);
        if (id <= 0) return ApiErrors.body(400, "invalid lessonId");
        UUID user = caller();
        if (user == null) return badSubject();
        store.unbookmark(user, id);
        return ResponseEntity.noContent().build();
    }

    interface LessonWrite { void apply(UUID user, long lessonId, String topicSlug); }

    /** Validates the lesson id and the {"topicSlug": ...} body, checks access with content, then writes. */
    private ResponseEntity<?> withLesson(String rawId, HttpServletRequest req, LessonWrite write) throws IOException {
        long id = lessonId(rawId);
        if (id <= 0) return ApiErrors.body(400, "invalid lessonId");
        String slug = topicSlug(req);
        if (slug == null) return ApiErrors.body(400, "topicSlug is required");
        int decision = access.check(id, slug, CurrentUser.require().credential());
        if (decision != 200)
            return ApiErrors.body(decision, "Check that the lesson belongs to this topic and your role has access");
        UUID user = caller();
        if (user == null) return badSubject();
        write.apply(user, id, slug);
        return ResponseEntity.noContent().build();
    }

    private String topicSlug(HttpServletRequest req) throws IOException {
        byte[] body = req.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) return null;
        try {
            JsonNode slug = json.readTree(body).get("topicSlug");
            if (slug == null || !slug.isString()) return null;
            String value = slug.asString();
            return value.length() <= 100 && SLUG.matcher(value).matches() ? value : null;
        } catch (JacksonException malformed) {
            return null;
        }
    }

    private static long lessonId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** The caller's id as stored: user_id is a UUID column. */
    private static UUID caller() {
        try {
            return UUID.fromString(CurrentUser.require().id());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static ResponseEntity<?> badSubject() { return ApiErrors.body(401, "invalid token subject"); }
}
