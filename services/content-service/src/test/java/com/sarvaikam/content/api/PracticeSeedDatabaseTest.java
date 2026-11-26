package com.sarvaikam.content.api;

import com.sarvaikam.content.service.BodyStorage;
import com.sarvaikam.content.service.ObjectStore;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** The bundled practice questions reach databases seeded by an earlier release, once, on a real PostgreSQL. */
class PracticeSeedDatabaseTest {
    static EmbeddedPostgres pg;
    static JdbcTemplate db;
    static PracticeController practice;

    @BeforeAll
    static void migrate() throws Exception {
        pg = EmbeddedPostgres.start();
        var ds = pg.getPostgresDatabase();
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").table("content_flyway_history")
                .baselineOnMigrate(true).baselineVersion("0").load().migrate();
        db = new JdbcTemplate(ds);
        ObjectStore noBucket = (ObjectStore) Proxy.newProxyInstance(ObjectStore.class.getClassLoader(),
                new Class<?>[]{ObjectStore.class}, (proxy, method, args) -> {
                    if (method.getName().equals("enabled")) return false;
                    throw new UnsupportedOperationException(method.getName());
                });
        practice = new PracticeController(db, new BodyStorage(noBucket));
    }

    @AfterAll
    static void stop() throws Exception { pg.close(); }

    private static JsonNode served() { return new ObjectMapper().readTree(practice.questions()); }

    @Test
    void anOlderStoredCopyIsReplacedOnceAndThenLeftAlone() throws Exception {
        practice.seed();
        int bundled = served().size();
        assertThat(bundled).isGreaterThanOrEqualTo(40);
        String hash = db.queryForObject("SELECT seed_sha256 FROM content_documents WHERE name = 'practice'", String.class);
        assertThat(hash).hasSize(64);

        assertThat(db.update("UPDATE content_documents SET body = 'old', seed_sha256 = ? WHERE name = 'practice'", hash))
                .as("same hash").isOne();
        practice.seed();
        assertThat(practice.questions()).as("an unchanged bundled file leaves the row alone").isEqualTo("old");

        // A database seeded before V9: an 8-question copy and no hash.
        db.update("UPDATE content_documents SET body = '[{\"id\":\"pair-sum\"}]', seed_sha256 = NULL WHERE name = 'practice'");
        practice.seed();
        assertThat(served().size()).isEqualTo(bundled);
        assertThat(db.queryForObject("SELECT seed_sha256 FROM content_documents WHERE name = 'practice'", String.class))
                .isEqualTo(hash);
    }

    @Test
    void everyQuestionBelongsToASeededTopicAndIsComplete() throws Exception {
        var json = new ObjectMapper();
        Set<String> topics = new HashSet<>();
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:seed/**/*.json")) {
            JsonNode root;
            try (InputStream in = resource.getInputStream()) { root = json.readTree(in); }
            for (JsonNode category : root.isArray() ? root : root.path("categories").isMissingNode() ? List.of(root) : root.path("categories"))
                for (JsonNode topic : category.path("topics")) topics.add(topic.path("slug").asString());
        }
        JsonNode questions;
        try (InputStream in = getClass().getResourceAsStream("/practice-questions.json")) { questions = json.readTree(in); }
        Set<String> ids = new HashSet<>();
        for (JsonNode q : questions) {
            String id = q.path("id").asString();
            assertThat(ids.add(id)).as("unique id " + id).isTrue();
            assertThat(topics).as(id).contains(q.path("topic").asString());
            assertThat(q.path("difficulty").asString()).as(id).isIn("Foundation", "Intermediate", "Advanced");
            for (String field : List.of("constraints", "hints", "criteria", "outline"))
                assertThat(q.path(field).size()).as(id + " " + field).isPositive();
        }
    }
}
