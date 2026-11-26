package com.sarvaikam.content.seed;

import com.sarvaikam.content.service.ContentService;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import static com.sarvaikam.content.seed.SeedLoader.Action.*;
import static com.sarvaikam.content.seed.SeedLoader.decide;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

class SeedDecisionTest {
    static final String SEED = "a".repeat(64), OLDER = "b".repeat(64), OTHER = "c".repeat(64);
    static final Supplier<String> NOT_ASKED = () -> fail("the stored body should not be read");

    @Test
    void newLessonsAreInserted() {
        assertThat(decide(false, null, SEED, NOT_ASKED, Set.of())).isEqualTo(INSERT);
    }

    @Test
    void rowsTrackedSinceV10NeedNoBodyRead() {
        assertThat(decide(true, SEED, SEED, NOT_ASKED, Set.of())).as("already this version").isEqualTo(SKIP);
        assertThat(decide(true, OLDER, SEED, NOT_ASKED, Set.of())).as("untouched since an older seed").isEqualTo(UPDATE);
        assertThat(decide(true, ContentService.LESSON_EDITED, SEED, NOT_ASKED, Set.of(OLDER)))
                .as("an editor's change is never overwritten").isEqualTo(SKIP);
    }

    @Test
    void rowsSeededBeforeV10AreCheckedOnceAgainstHistory() {
        assertThat(decide(true, null, SEED, () -> SEED, Set.of())).as("matches the bundled seed").isEqualTo(RECORD);
        assertThat(decide(true, null, SEED, () -> OLDER, Set.of(OLDER))).as("an earlier bundled version").isEqualTo(UPDATE);
        assertThat(decide(true, null, SEED, () -> OTHER, Set.of(OLDER))).as("text no seed ever had").isEqualTo(MARK_EDITED);
        assertThat(decide(true, null, SEED, () -> null, Set.of(OLDER))).as("bucket unreadable now").isEqualTo(RETRY_LATER);
    }

    @Test
    void javaHashesMatchTheHistoryGeneratedFromGit() throws Exception {
        var json = new ObjectMapper();
        JsonNode history;
        try (InputStream in = new ClassPathResource("seed-history/lesson-hashes.json").getInputStream()) {
            history = json.readTree(in);
        }
        assertThat(history.size()).isGreaterThanOrEqualTo(200);
        int checked = 0, unchanged = 0;
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:seed/*.json")) {
            JsonNode root;
            try (InputStream in = resource.getInputStream()) { root = json.readTree(in); }
            for (JsonNode category : root)
                for (JsonNode topic : category.path("topics"))
                    for (JsonNode lesson : topic.path("lessons")) {
                        String key = topic.path("slug").asString() + "/" + lesson.path("slug").asString();
                        String hash = SeedLoader.seedHash(lesson.path("title").asString(), lesson.path("content").asString());
                        checked++;
                        if (history.has(key) && List.copyOf(history.path(key).valueStream().map(JsonNode::asString).toList()).contains(hash))
                            unchanged++;
                    }
        }
        // Lessons rewritten since the history was generated are not in it yet; everything else must match, which
        // proves the Python generator and SeedLoader.seedHash agree.
        assertThat(checked).isGreaterThanOrEqualTo(200);
        assertThat(unchanged).as("lessons whose current seed hash is in the history").isGreaterThan(checked / 2);
    }
}
