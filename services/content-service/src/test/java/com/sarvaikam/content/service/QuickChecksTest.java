package com.sarvaikam.content.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** quick-checks.json must match real lessons, cover the Gen AI path, and stay well-formed. */
class QuickChecksTest {
    private final ObjectMapper json = new ObjectMapper();

    private Map<String, List<QuickChecks.Question>> checks() throws Exception {
        try (InputStream in = new ClassPathResource("quick-checks.json").getInputStream()) {
            return QuickChecks.load(in);
        }
    }

    private Set<String> seededLessons() throws Exception {
        Set<String> keys = new HashSet<>();
        for (var resource : new PathMatchingResourcePatternResolver().getResources("classpath*:seed/**/*.json")) {
            JsonNode root;
            try (InputStream in = resource.getInputStream()) { root = json.readTree(in); }
            for (JsonNode category : root.isArray() ? root : root.path("categories").isMissingNode() ? List.of(root) : root.path("categories"))
                for (JsonNode topic : category.path("topics"))
                    for (JsonNode lesson : topic.path("lessons"))
                        keys.add(topic.path("slug").asString() + "/" + lesson.path("slug").asString());
        }
        return keys;
    }

    @Test
    void everyQuickCheckBelongsToARealLessonAndIsWellFormed() throws Exception {
        Set<String> lessons = seededLessons();
        checks().forEach((key, questions) -> {
            assertThat(lessons).as("lesson for " + key).contains(key);
            assertThat(questions).as(key).hasSizeBetween(2, 4);
            for (var q : questions) {
                assertThat(q.question()).isNotBlank();
                assertThat(q.options()).as(q.question()).hasSizeBetween(3, 5).doesNotHaveDuplicates();
                assertThat(q.explain()).as(q.question()).isNotBlank();
            }
        });
    }

    @Test
    void theGenAiPathIsFullyCovered() throws Exception {
        JsonNode paths;
        try (InputStream in = new ClassPathResource("engineering-paths.json").getInputStream()) { paths = json.readTree(in); }
        Set<String> genAiTopics = new HashSet<>();
        for (JsonNode path : paths)
            if (path.path("slug").asString().equals("gen-ai"))
                path.path("topics").forEach(t -> genAiTopics.add(t.asString()));
        var missing = seededLessons().stream().filter(k -> genAiTopics.contains(k.split("/")[0]))
                .filter(k -> !checksUnchecked().containsKey(k)).toList();
        assertThat(missing).as("Gen AI path lessons without a quick check").isEmpty();
    }

    private Map<String, List<QuickChecks.Question>> checksUnchecked() {
        try { return checks(); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Test
    void shufflingKeepsTheRightAnswerAndIsStable() throws Exception {
        Set<Integer> positions = new HashSet<>();
        for (var questions : checks().values())
            for (var q : questions) {
                var once = QuickChecks.shuffled(q);
                assertThat(once.options().get(once.answer())).isEqualTo(q.options().get(q.answer()));
                assertThat(QuickChecks.shuffled(q)).isEqualTo(once);
                positions.add(once.answer());
            }
        assertThat(positions).as("answers spread over several positions").hasSizeGreaterThanOrEqualTo(3);
    }
}
