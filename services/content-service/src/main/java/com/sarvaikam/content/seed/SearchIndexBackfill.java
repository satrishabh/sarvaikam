package com.sarvaikam.content.seed;

import com.sarvaikam.content.service.BodyStorage;
import com.sarvaikam.content.service.SearchText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Fills search_text for lessons written before search existed (V8). Runs in the background after start-up so
 * reading bodies from the bucket never delays readiness; new and edited lessons get it in upsertLesson.
 */
@Component
@Order(30)
public class SearchIndexBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SearchIndexBackfill.class);
    private final JdbcTemplate db;
    private final BodyStorage bodies;

    public SearchIndexBackfill(JdbcTemplate db, BodyStorage bodies) {
        this.db = db;
        this.bodies = bodies;
    }

    @Override
    public void run(ApplicationArguments args) {
        Thread.ofVirtual().name("search-backfill").start(this::backfill);
    }

    /** Returns how many lessons were indexed. Rows whose body cannot be read are skipped and retried next start. */
    int backfill() {
        long after = 0;
        int indexed = 0;
        try {
            while (true) {
                var rows = db.queryForList("SELECT id, content_md, content_object FROM lessons "
                        + "WHERE search_text IS NULL AND id > ? ORDER BY id LIMIT 50", after);
                if (rows.isEmpty()) break;
                for (var row : rows) {
                    long id = ((Number) row.get("id")).longValue();
                    after = id;
                    String body;
                    try {
                        Object object = row.get("content_object");
                        body = object != null && bodies.enabled() ? bodies.read((String) object) : (String) row.get("content_md");
                    } catch (RuntimeException unreadable) {
                        log.warn("search index: could not read lesson {} body: {}", id, unreadable.getMessage());
                        continue;
                    }
                    indexed += db.update("UPDATE lessons SET search_text = ? WHERE id = ? AND search_text IS NULL",
                            SearchText.plain(body), id);
                }
            }
            if (indexed > 0) log.info("search index: indexed {} existing lessons", indexed);
        } catch (RuntimeException e) {
            log.warn("search index backfill stopped: {}", e.getMessage());
        }
        return indexed;
    }
}
