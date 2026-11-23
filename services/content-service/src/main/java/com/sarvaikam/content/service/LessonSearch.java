package com.sarvaikam.content.service;

import com.sarvaikam.content.security.ContentAccess;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/** Full-text lesson search (V8). Exclusive lessons are listed, as in topic outlines, but without a snippet. */
@Service
public class LessonSearch {
    /** Mark the matched words inside a snippet; the client highlights the text between them. */
    public static final String START = "\u0002";
    public static final String STOP = "\u0003";
    static final int MAX_QUERY = 200;

    public record Hit(long id, String slug, String title, String topicSlug, String topicName, boolean exclusive,
                      String stage, String snippet) {}

    private final JdbcTemplate db;

    public LessonSearch(JdbcTemplate db) { this.db = db; }

    public List<Hit> search(String q) {
        String query = q == null ? "" : q.strip();
        if (query.length() < 2) return List.of();
        if (query.length() > MAX_QUERY) query = query.substring(0, MAX_QUERY);
        boolean exclusiveAccess = ContentAccess.has("content.exclusive") || ContentAccess.has("content.manage");
        // Rank first, then build snippets only for the 20 results (ts_headline is the expensive part).
        return db.query("""
                SELECT r.id, r.slug, r.title, r.topic_slug, r.topic_name, r.exclusive, r.stage,
                       ts_headline('english', coalesce(r.search_text, ''), r.q,
                                   'MaxWords=28, MinWords=12, MaxFragments=1, StartSel=' || ? || ', StopSel=' || ?) AS snippet
                FROM (SELECT l.id, l.slug, l.title, l.exclusive, l.stage, l.search_text, t.slug AS topic_slug,
                             t.name AS topic_name, q, ts_rank(l.search_vector, q) AS rank
                      FROM lessons l JOIN topics t ON t.id = l.topic_id,
                           websearch_to_tsquery('english', ?) q
                      WHERE l.search_vector @@ q
                      ORDER BY rank DESC, l.id
                      LIMIT 20) r
                ORDER BY r.rank DESC, r.id
                """,
                (rs, i) -> {
                    boolean exclusive = rs.getBoolean("exclusive");
                    return new Hit(rs.getLong("id"), rs.getString("slug"), rs.getString("title"),
                            rs.getString("topic_slug"), rs.getString("topic_name"), exclusive, rs.getString("stage"),
                            exclusive && !exclusiveAccess ? null : rs.getString("snippet"));
                },
                START, STOP, query);
    }
}
