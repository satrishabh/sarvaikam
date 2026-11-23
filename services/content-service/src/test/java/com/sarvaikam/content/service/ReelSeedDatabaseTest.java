package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.Lesson;
import com.sarvaikam.content.domain.LessonRepository;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Seed reels land once as drafts on a real reels database, and never come back after an editor deletes them. */
class ReelSeedDatabaseTest {
    static EmbeddedPostgres pg;
    static JdbcTemplate db;

    @BeforeAll
    static void migrate() throws Exception {
        pg = EmbeddedPostgres.start();
        Flyway.configure().dataSource(pg.getPostgresDatabase()).locations("classpath:reels-db").load().migrate();
        db = new JdbcTemplate(pg.getPostgresDatabase());
    }

    @AfterAll
    static void stop() throws Exception { pg.close(); }

    private static Lesson lesson(String title) {
        var lesson = new Lesson();
        lesson.setTitle(title);
        return lesson;
    }

    @Test
    void seedsAreDraftsAddedOnceAndDeletionsStick() {
        var lessons = mock(LessonRepository.class);
        when(lessons.findByTopicSlugAndSlug(anyString(), anyString())).thenReturn(Optional.empty());
        when(lessons.findByTopicSlugAndSlug("llms", "prompting")).thenReturn(Optional.of(lesson("Prompt engineering")));
        var service = new ReelService(lessons, mock(BodyStorage.class), db);
        var seeds = List.of(
                new ReelService.SeedReel("prompt-checklist", "llms", "prompting", "Checklist", "Line one.\nLine two."),
                new ReelService.SeedReel("later", "llms", "not-yet", "Later", "Waits for its lesson."));

        assertThat(service.seedDrafts(seeds)).isEqualTo(1);
        var row = db.queryForMap("SELECT * FROM reels WHERE slug = 'prompt-checklist'");
        assertThat(row.get("published")).isEqualTo(false);
        assertThat(row.get("source_name")).isEqualTo("Sarvaikam lesson: Prompt engineering");
        assertThat(row.get("source_url")).isEqualTo("https://learn.sarvaikam.com/topics/llms/prompting");

        assertThat(service.seedDrafts(seeds)).as("second start").isZero();
        db.update("DELETE FROM reels WHERE slug = 'prompt-checklist'");
        assertThat(service.seedDrafts(seeds)).as("after an editor deleted it").isZero();

        when(lessons.findByTopicSlugAndSlug("llms", "not-yet")).thenReturn(Optional.of(lesson("Later lesson")));
        assertThat(service.seedDrafts(seeds)).as("once its lesson exists").isEqualTo(1);
    }

    @Test
    void everySeedReelPointsAtARealLessonAndFitsTheEditor() throws Exception {
        var json = new ObjectMapper();
        Set<String> lessons = new HashSet<>();
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:seed/**/*.json")) {
            JsonNode root;
            try (InputStream in = resource.getInputStream()) { root = json.readTree(in); }
            for (JsonNode category : root.isArray() ? root : root.path("categories").isMissingNode() ? List.of(root) : root.path("categories"))
                for (JsonNode topic : category.path("topics"))
                    for (JsonNode lesson : topic.path("lessons"))
                        lessons.add(topic.path("slug").asString() + "/" + lesson.path("slug").asString());
        }
        List<ReelService.SeedReel> seeds;
        try (InputStream in = new ClassPathResource("reels-seed.json").getInputStream()) {
            seeds = json.readValue(in, new TypeReference<>() {});
        }
        assertThat(seeds).hasSizeGreaterThanOrEqualTo(30);
        assertThat(seeds).extracting(ReelService.SeedReel::slug).doesNotHaveDuplicates()
                .allMatch(s -> s.matches("[a-z0-9]+(-[a-z0-9]+)*") && s.length() <= 150);
        for (var seed : seeds) {
            assertThat(lessons).as(seed.slug()).contains(seed.courseSlug() + "/" + seed.lessonSlug());
            assertThat(seed.heading()).hasSizeLessThanOrEqualTo(250).isNotBlank();
            assertThat(seed.content()).hasSizeLessThanOrEqualTo(2000).isNotBlank();
        }
    }
}
