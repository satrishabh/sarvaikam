package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.security.ContentAccess;
import jakarta.validation.constraints.*;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class ReelService implements ApplicationRunner {
    public record ReelRequest(
        @NotBlank @Pattern(regexp="[a-z0-9]+(-[a-z0-9]+)*") @Size(max=150) String slug,
        @NotBlank @Size(max=100) String courseSlug,
        @NotBlank @Size(max=150) String lessonSlug,
        @NotBlank @Size(max=250) String heading,
        @NotBlank @Size(max=2000) String content,
        @NotBlank @Size(max=250) String sourceName,
        @NotBlank @Size(max=2000) @Pattern(regexp="https://[^\\s]+") String sourceUrl,
        boolean published) {}
    public record ReelView(String slug, String courseSlug, String courseName, String lessonSlug,
                           int step, String heading, String content, String sourceName, String sourceUrl, boolean published) {}
    private final JdbcTemplate db;
    private final LessonRepository lessons;
    private final BodyStorage bodies;

    @Autowired
    public ReelService(LessonRepository lessons, BodyStorage bodies,
                       @Value("${REELS_DB_URL:}") String url,
                       @Value("${REELS_DB_USER:sarvaikam}") String user,
                       @Value("${REELS_DB_PASSWORD:}") String password) {
        this.lessons = lessons; this.bodies = bodies;
        if (url.isBlank()) { db = null; return; }
        var datasource = new DriverManagerDataSource(url, user, password);
        Flyway.configure().dataSource(datasource).locations("classpath:reels-db").load().migrate();
        db = new JdbcTemplate(datasource);
    }
    ReelService(LessonRepository lessons, BodyStorage bodies, JdbcTemplate db) {
        this.lessons = lessons; this.bodies = bodies; this.db = db;
    }
    public void run(ApplicationArguments args) {
        if (db == null || !bodies.enabled()) return;
        for (var row : db.queryForList("SELECT slug, content FROM reels WHERE content_object IS NULL")) {
            String content = (String) row.get("content");
            String object = bodies.write("reel-bodies", content);
            db.update("UPDATE reels SET content_object = ?, content = NULL WHERE slug = ? AND content_object IS NULL AND content = ?", object, row.get("slug"), content);
        }
    }
    private JdbcTemplate db() {
        if (db == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Reels database is not configured");
        return db;
    }
    @Transactional(readOnly=true)
    public List<ReelView> list(boolean admin, int limit, int offset) {
        if (admin) ContentAccess.require("content.manage");
        // Resolve current course/step/access from the catalogue; deleted and exclusive lessons cannot leak.
        var result = new ArrayList<ReelView>();
        for (var row : db().queryForList("SELECT * FROM reels " + (admin ? "" : "WHERE published = true ") + "ORDER BY updated_at DESC, slug")) {
            var found = lessons.findByTopicSlugAndSlug((String)row.get("course_slug"), (String)row.get("lesson_slug"));
            if (found.isEmpty()) continue;
            var lesson = found.get();
            if (!admin && lesson.isExclusive() && !ContentAccess.has("content.manage") && !ContentAccess.has("content.exclusive")) continue;
            if (offset > 0) { offset--; continue; }
            String object = (String)row.get("content_object");
            result.add(new ReelView((String)row.get("slug"), lesson.getTopic().getSlug(), lesson.getTopic().getName(),
                lesson.getSlug(), lesson.getStepNumber(), (String)row.get("heading"),
                object == null ? (String)row.get("content") : bodies.read(object),
                (String)row.get("source_name"), (String)row.get("source_url"), (Boolean)row.get("published")));
            if (result.size() == limit) break;
        }
        return result;
    }
    @Transactional(readOnly=true)
    public void save(ReelRequest r) {
        ContentAccess.require("content.manage");
        db();
        if (lessons.findByTopicSlugAndSlug(r.courseSlug(), r.lessonSlug()).isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an existing course and lesson step");
        try {
            var uri = java.net.URI.create(r.sourceUrl());
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Source must be a valid HTTPS URL"); }
        String object = bodies.enabled() ? bodies.write("reel-bodies", r.content()) : null;
        db().update("""
            INSERT INTO reels(slug, course_slug, lesson_slug, heading, content, content_object, source_name, source_url, published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET course_slug=excluded.course_slug, lesson_slug=excluded.lesson_slug,
            heading=excluded.heading, content=excluded.content, content_object=excluded.content_object,
            source_name=excluded.source_name, source_url=excluded.source_url, published=excluded.published, updated_at=now()
            """, r.slug(), r.courseSlug(), r.lessonSlug(), r.heading(), object == null ? r.content() : null,
            object, r.sourceName(), r.sourceUrl(), r.published());
    }
    public void delete(String slug) {
        ContentAccess.require("content.manage");
        if (db().update("DELETE FROM reels WHERE slug = ?", slug) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reel not found");
    }
}
