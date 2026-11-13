package com.sarvaikam.content.seed;

import com.sarvaikam.content.service.BodyStorage;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Reads database edits rather than seeds; retries safely after interrupted uploads. */
@Component
@Order(10)
public class BodyMigration implements ApplicationRunner {
    private final JdbcTemplate db;
    private final BodyStorage bodies;
    public BodyMigration(JdbcTemplate db, BodyStorage bodies) { this.db = db; this.bodies = bodies; }
    public void run(ApplicationArguments args) {
        if (!bodies.enabled()) return;
        while (true) {
            var rows = db.queryForList("SELECT id, content_md FROM lessons WHERE content_object IS NULL AND content_md IS NOT NULL LIMIT 50");
            if (rows.isEmpty()) return;
            for (var row : rows) {
                String body = (String) row.get("content_md");
                String object = bodies.write("lesson-bodies", body);
                // Do not replace concurrent CMS edits.
                db.update("UPDATE lessons SET content_object = ?, content_md = NULL WHERE id = ? AND content_object IS NULL AND content_md = ?",
                        object, row.get("id"), body);
            }
        }
    }
}
