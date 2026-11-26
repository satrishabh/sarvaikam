package com.sarvaikam.content.api;

import com.sarvaikam.content.service.BodyStorage;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import java.nio.charset.StandardCharsets;

@RestController
public class PracticeController implements ApplicationRunner {
    private final JdbcTemplate db;
    private final BodyStorage bodies;
    public PracticeController(JdbcTemplate db, BodyStorage bodies) { this.db = db; this.bodies = bodies; }
    public void run(ApplicationArguments args) throws Exception { seed(); }

    /**
     * Stores the bundled practice questions, and replaces the stored copy when the bundled file has changed (new
     * questions in a release). Nothing in the app edits this document, so the file is the source of truth.
     * A replaced copy goes back to the database first and is moved to the bucket below, like a new one.
     */
    public void seed() throws java.io.IOException {
        byte[] bundled;
        try (var in = new ClassPathResource("practice-questions.json").getInputStream()) { bundled = in.readAllBytes(); }
        String hash;
        try {
            hash = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bundled));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        db.update("""
                INSERT INTO content_documents(name, body, seed_sha256) VALUES ('practice', ?, ?)
                ON CONFLICT (name) DO UPDATE SET body = EXCLUDED.body, content_object = NULL, seed_sha256 = EXCLUDED.seed_sha256
                WHERE content_documents.seed_sha256 IS DISTINCT FROM EXCLUDED.seed_sha256
                """, new String(bundled, StandardCharsets.UTF_8), hash);
        if (bodies.enabled()) {
            for (var row : db.queryForList("SELECT name, body FROM content_documents WHERE content_object IS NULL")) {
                String body = (String) row.get("body");
                String object = bodies.write("practice-bodies", body);
                db.update("UPDATE content_documents SET content_object = ?, body = NULL WHERE name = ? AND content_object IS NULL AND body = ?", object, row.get("name"), body);
            }
        }
    }
    @GetMapping(value="/practice", produces=MediaType.APPLICATION_JSON_VALUE)
    public String questions() {
        var row = db.queryForMap("SELECT body, content_object FROM content_documents WHERE name = 'practice'");
        return row.get("content_object") == null ? (String)row.get("body") : bodies.read((String)row.get("content_object"));
    }
}
