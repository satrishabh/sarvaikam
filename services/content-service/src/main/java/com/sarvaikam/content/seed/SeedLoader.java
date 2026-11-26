package com.sarvaikam.content.seed;

import com.sarvaikam.content.api.Dtos.*;
import com.sarvaikam.content.domain.CategoryRepository;
import com.sarvaikam.content.domain.Lesson;
import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.domain.TopicRepository;
import com.sarvaikam.content.service.BodyStorage;
import com.sarvaikam.content.service.ContentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.function.Supplier;

/**
 * Loads every seed/*.json file (in filename order) on startup. Files are merged: a topic may appear in
 * several files and its lessons are appended in order. Missing categories, topics and lessons are inserted.
 * A lesson whose seed has been rewritten is updated too, unless an editor has changed it in the Content studio:
 * lessons.seed_sha256 records the seed version each lesson still matches (see {@link #decide}).
 */
@Component
@org.springframework.core.annotation.Order(0)
public class SeedLoader implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SeedLoader.class);

    record SeedLesson(String slug, String title, String content, String stage) {}
    record SeedTopic(String slug, String name, String summary, String level, List<SeedLesson> lessons) {}
    record SeedCategory(String slug, String name, String description, String icon, List<SeedTopic> topics) {}

    private final ContentService service;
    private final CategoryRepository categories;
    private final TopicRepository topics;
    private final LessonRepository lessons;
    private final ObjectMapper mapper;
    private final String pattern;
    private final JdbcTemplate db;
    private final BodyStorage bodies;

    public SeedLoader(ContentService service, CategoryRepository categories, TopicRepository topics,
                      LessonRepository lessons, ObjectMapper mapper, @Value("${app.seed-pattern}") String pattern,
                      JdbcTemplate db, BodyStorage bodies) {
        this.service = service;
        this.categories = categories;
        this.topics = topics;
        this.lessons = lessons;
        this.mapper = mapper;
        this.pattern = pattern;
        this.db = db;
        this.bodies = bodies;
    }

    /** What to do with one seed lesson on startup. */
    enum Action { INSERT, SKIP, RECORD, UPDATE, MARK_EDITED, RETRY_LATER }

    /** SHA-256 of a lesson's title and body: identifies one version of it. */
    static String seedHash(String title, String body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((title + "\n\n" + body).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    /**
     * @param exists   whether the lesson is in the database
     * @param stored   its seed_sha256: a seed hash, {@link ContentService#LESSON_EDITED}, or null (seeded before V10)
     * @param seed     the hash of the bundled seed version
     * @param current  the hash of the stored title and body, or null if the body cannot be read now; only asked
     *                 for rows seeded before V10
     * @param earlier  hashes of every earlier bundled version of this lesson (seed-history)
     */
    static Action decide(boolean exists, String stored, String seed, Supplier<String> current, Set<String> earlier) {
        if (!exists) return Action.INSERT;
        if (seed.equals(stored) || ContentService.LESSON_EDITED.equals(stored)) return Action.SKIP;
        if (stored != null) return Action.UPDATE; // untouched since an older seed version
        String now = current.get();
        if (now == null) return Action.RETRY_LATER;
        if (now.equals(seed)) return Action.RECORD;
        return earlier.contains(now) ? Action.UPDATE : Action.MARK_EDITED;
    }

    /** topic/lesson -> hashes of earlier bundled versions, generated from git history (scripts/seed-history.py). */
    Map<String, Set<String>> history() {
        var resource = new ClassPathResource("seed-history/lesson-hashes.json");
        if (!resource.exists()) return Map.of();
        try (InputStream in = resource.getInputStream()) {
            Map<String, Set<String>> history = new HashMap<>();
            mapper.readTree(in).properties().forEach(e -> {
                Set<String> hashes = new HashSet<>();
                e.getValue().forEach(h -> hashes.add(h.asString()));
                history.put(e.getKey(), hashes);
            });
            return history;
        } catch (Exception e) {
            log.warn("Seed history unreadable; rewritten seeds will only reach lessons seeded after V10", e);
            return Map.of();
        }
    }

    /** Hash of what is stored now; null when the body is in a bucket that cannot be read at the moment. */
    private String storedHash(Lesson lesson) {
        try {
            String body = lesson.getContentObject() == null ? lesson.getContentMd()
                    : bodies.enabled() ? bodies.read(lesson.getContentObject()) : null;
            return body == null ? null : seedHash(lesson.getTitle(), body);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private void recordSeed(Long lessonId, String hash) {
        // Plain JDBC: recording the version is not an edit, so updated_at (the sitemap's lastmod) stays.
        db.update("UPDATE lessons SET seed_sha256 = ? WHERE id = ?", hash, lessonId);
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        Resource[] files = new PathMatchingResourcePatternResolver().getResources(pattern);
        Arrays.sort(files, Comparator.comparing(Resource::getFilename));

        // categorySlug -> category, preserving first-seen order; topicSlug -> merged lessons
        Map<String, SeedCategory> cats = new LinkedHashMap<>();
        Map<String, Map<String, SeedTopic>> topicsByCat = new LinkedHashMap<>();
        Map<String, List<SeedLesson>> lessonsByTopic = new HashMap<>();

        for (Resource file : files) {
            try (InputStream in = file.getInputStream()) {
                for (SeedCategory c : mapper.readValue(in, SeedCategory[].class)) {
                    cats.putIfAbsent(c.slug(), c);
                    var catTopics = topicsByCat.computeIfAbsent(c.slug(), k -> new LinkedHashMap<>());
                    for (SeedTopic t : c.topics()) {
                        catTopics.putIfAbsent(t.slug(), t);
                        lessonsByTopic.computeIfAbsent(t.slug(), k -> new ArrayList<>()).addAll(t.lessons());
                    }
                }
            }
        }

        Map<String, Set<String>> history = history();
        int added = 0, updated = 0, order = 0;
        for (SeedCategory c : cats.values()) {
            if (categories.findBySlug(c.slug()).isEmpty()) {
                service.upsertCategory(new CategoryRequest(c.slug(), c.name(), c.description(), c.icon(), order));
            }
            order++;
            int tOrder = 0;
            for (SeedTopic t : topicsByCat.get(c.slug()).values()) {
                if (topics.findBySlug(t.slug()).isEmpty()) {
                    service.upsertTopic(new TopicRequest(c.slug(), t.slug(), t.name(), t.summary(), t.level(), tOrder));
                }
                tOrder++;
                List<SeedLesson> ls = lessonsByTopic.get(t.slug());
                for (int i = 0; i < ls.size(); i++) {
                    SeedLesson l = ls.get(i);
                    String stage = l.stage() == null ? "STARTER" : l.stage();
                    String hash = seedHash(l.title(), l.content());
                    Optional<Lesson> row = lessons.findByTopicSlugAndSlug(t.slug(), l.slug());
                    Action action = decide(row.isPresent(), row.map(Lesson::getSeedSha256).orElse(null), hash,
                            () -> storedHash(row.get()), history.getOrDefault(t.slug() + "/" + l.slug(), Set.of()));
                    try {
                        switch (action) {
                            case INSERT -> {
                                var saved = service.upsertLesson(new LessonRequest(t.slug(), l.slug(), l.title(), i + 1, l.content(), false, stage));
                                recordSeed(saved.id(), hash);
                                added++;
                            }
                            case UPDATE -> {
                                var saved = service.upsertLesson(new LessonRequest(t.slug(), l.slug(), l.title(), i + 1, l.content(), row.get().isExclusive(), stage));
                                recordSeed(saved.id(), hash);
                                updated++;
                            }
                            case RECORD -> recordSeed(row.get().getId(), hash);
                            case MARK_EDITED -> recordSeed(row.get().getId(), ContentService.LESSON_EDITED);
                            case SKIP, RETRY_LATER -> { }
                        }
                    } catch (RuntimeException e) {
                        log.warn("Seed lesson {}/{} not applied ({}); retrying on the next start", t.slug(), l.slug(), action, e);
                    }
                }
            }
        }
        log.info("Seed sync from {} file(s): {} categories, {} new lessons, {} updated to a newer seed",
                files.length, cats.size(), added, updated);
    }
}
