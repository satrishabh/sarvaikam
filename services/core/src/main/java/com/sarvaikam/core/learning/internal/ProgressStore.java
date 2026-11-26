package com.sarvaikam.core.learning.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The lesson_progress and lesson_bookmarks tables. progress-service writes the same tables while both run, so the
 * SQL keeps its semantics: inserts are idempotent and deletes of absent rows succeed.
 */
@Repository
class ProgressStore {
    record ProgressItem(long lessonId, String topicSlug, OffsetDateTime completedAt) {}
    record BookmarkItem(long lessonId, String topicSlug, OffsetDateTime createdAt) {}

    private final JdbcClient db;

    ProgressStore(JdbcClient db) { this.db = db; }

    List<ProgressItem> progress(UUID user) {
        return db.sql("SELECT lesson_id, topic_slug, completed_at FROM lesson_progress WHERE user_id = ? ORDER BY completed_at DESC")
                .param(user)
                .query((rs, n) -> new ProgressItem(rs.getLong(1), rs.getString(2), rs.getObject(3, OffsetDateTime.class)))
                .list();
    }

    List<Long> completedInTopic(UUID user, String topicSlug) {
        return db.sql("SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND topic_slug = ?")
                .param(user).param(topicSlug).query(Long.class).list();
    }

    /** Returns the completion time when this call created the mark, or null when it already existed. */
    OffsetDateTime complete(UUID user, long lessonId, String topicSlug) {
        return db.sql("""
                INSERT INTO lesson_progress (user_id, lesson_id, topic_slug) VALUES (?, ?, ?)
                ON CONFLICT DO NOTHING RETURNING completed_at""")
                .param(user).param(lessonId).param(topicSlug)
                .query(OffsetDateTime.class).optional().orElse(null);
    }

    boolean uncomplete(UUID user, long lessonId) {
        return db.sql("DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?")
                .param(user).param(lessonId).update() > 0;
    }

    List<BookmarkItem> bookmarks(UUID user) {
        return db.sql("SELECT lesson_id, topic_slug, created_at FROM lesson_bookmarks WHERE user_id = ? ORDER BY created_at DESC")
                .param(user)
                .query((rs, n) -> new BookmarkItem(rs.getLong(1), rs.getString(2), rs.getObject(3, OffsetDateTime.class)))
                .list();
    }

    void bookmark(UUID user, long lessonId, String topicSlug) {
        db.sql("INSERT INTO lesson_bookmarks (user_id, lesson_id, topic_slug) VALUES (?, ?, ?) ON CONFLICT DO NOTHING")
                .param(user).param(lessonId).param(topicSlug).update();
    }

    void unbookmark(UUID user, long lessonId) {
        db.sql("DELETE FROM lesson_bookmarks WHERE user_id = ? AND lesson_id = ?").param(user).param(lessonId).update();
    }
}
