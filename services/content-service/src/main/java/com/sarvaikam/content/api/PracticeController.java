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
    public void run(ApplicationArguments args) throws Exception {
        try (var in = new ClassPathResource("practice-questions.json").getInputStream()) {
            db.update("INSERT INTO content_documents(name, body) VALUES ('practice', ?) ON CONFLICT DO NOTHING",
                new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
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
