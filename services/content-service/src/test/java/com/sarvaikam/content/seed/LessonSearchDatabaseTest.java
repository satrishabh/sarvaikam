package com.sarvaikam.content.seed;

import com.sarvaikam.content.service.BodyStorage;
import com.sarvaikam.content.service.LessonSearch;
import com.sarvaikam.content.service.ObjectStore;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs every Flyway migration on a real PostgreSQL, then checks the search backfill and ranking.
 * Lesson bodies stored in the bucket (content_md NULL) must be searchable too.
 */
class LessonSearchDatabaseTest {
    static EmbeddedPostgres pg;
    static JdbcTemplate db;
    static final Map<String, byte[]> bucket = Map.of("lesson-bodies/rag.md",
            "## Retrieval\nA **vector database** stores embeddings for [semantic search](https://x.y).".getBytes(StandardCharsets.UTF_8));

    @BeforeAll
    static void migrate() throws Exception {
        pg = EmbeddedPostgres.start();
        var ds = pg.getPostgresDatabase();
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").table("content_flyway_history")
                .baselineOnMigrate(true).baselineVersion("0").load().migrate();
        db = new JdbcTemplate(ds);
        db.update("INSERT INTO categories (slug, name) VALUES ('ai', 'AI')");
        db.update("INSERT INTO topics (category_id, slug, name) SELECT id, 'gen-ai', 'Generative AI' FROM categories");
        long topic = db.queryForObject("SELECT id FROM topics", Long.class);
        db.update("INSERT INTO lessons (topic_id, slug, title, step_number, content_md) VALUES (?, 'prompts', 'Prompt design', 1, ?)",
                topic, "Write clear prompts. Mention the vector store only in passing.");
        db.update("INSERT INTO lessons (topic_id, slug, title, step_number, content_md, content_object) VALUES (?, 'rag', 'Vector databases', 2, NULL, 'lesson-bodies/rag.md')",
                topic);
        db.update("INSERT INTO lessons (topic_id, slug, title, step_number, content_md, exclusive) VALUES (?, 'secret', 'Private vector tricks', 3, 'Exclusive notes on vector indexes.', true)",
                topic);
        ObjectStore store = (ObjectStore) Proxy.newProxyInstance(ObjectStore.class.getClassLoader(), new Class<?>[]{ObjectStore.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "enabled" -> true;
                    case "read" -> bucket.get((String) args[0]);
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        int indexed = new SearchIndexBackfill(db, new BodyStorage(store)).backfill();
        assertThat(indexed).isEqualTo(3);
    }

    @AfterAll
    static void stop() throws Exception { pg.close(); }

    @AfterEach
    void signOut() { SecurityContextHolder.clearContext(); }

    @Test
    void findsBucketBodiesAndRanksTitlesFirst() {
        List<LessonSearch.Hit> hits = new LessonSearch(db).search("vector database");
        assertThat(hits).extracting(LessonSearch.Hit::slug).first().isEqualTo("rag");
        var rag = hits.getFirst();
        assertThat(rag.topicSlug()).isEqualTo("gen-ai");
        assertThat(rag.snippet()).contains(LessonSearch.START + "database" + LessonSearch.STOP).doesNotContain("https://", "**");
    }

    @Test
    void exclusiveLessonsAreListedWithoutTheirTextUnlessAllowed() {
        var anonymous = new LessonSearch(db).search("indexes").stream().filter(h -> h.slug().equals("secret")).findFirst().orElseThrow();
        assertThat(anonymous.exclusive()).isTrue();
        assertThat(anonymous.snippet()).isNull();

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("b", null,
                List.of(new SimpleGrantedAuthority("content.exclusive"))));
        var business = new LessonSearch(db).search("indexes").stream().filter(h -> h.slug().equals("secret")).findFirst().orElseThrow();
        assertThat(business.snippet()).contains("indexes");
    }

    @Test
    void tooShortOrOddQueriesAreSafe() {
        var search = new LessonSearch(db);
        assertThat(search.search(" ")).isEmpty();
        assertThat(search.search("a")).isEmpty();
        assertThat(search.search("\"unterminated OR -")).isNotNull();
        assertThat(search.search("x".repeat(5000))).isEmpty();
    }

    @Test
    void editedLessonsAreReindexedByTheGeneratedColumn() {
        db.update("UPDATE lessons SET search_text = 'kubernetes operators' WHERE slug = 'prompts'");
        assertThat(new LessonSearch(db).search("kubernetes")).extracting(LessonSearch.Hit::slug).containsExactly("prompts");
    }
}
