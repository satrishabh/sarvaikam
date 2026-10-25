package com.sarvaikam.content.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sarvaikam.content.api.Dtos.*;
import com.sarvaikam.content.domain.CategoryRepository;
import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.domain.TopicRepository;
import com.sarvaikam.content.service.ContentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.*;

/**
 * Loads every seed/*.json file (in filename order) on startup. Files are merged: a topic may appear in
 * several files and its lessons are appended in order. Only missing categories, topics and lessons are
 * inserted, so new seed content reaches existing databases without overwriting edits made in the admin CMS.
 */
@Component
public class SeedLoader implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SeedLoader.class);

    record SeedLesson(String slug, String title, String content) {}
    record SeedTopic(String slug, String name, String summary, String level, List<SeedLesson> lessons) {}
    record SeedCategory(String slug, String name, String description, String icon, List<SeedTopic> topics) {}

    private final ContentService service;
    private final CategoryRepository categories;
    private final TopicRepository topics;
    private final LessonRepository lessons;
    private final ObjectMapper mapper;
    private final String pattern;

    public SeedLoader(ContentService service, CategoryRepository categories, TopicRepository topics,
                      LessonRepository lessons, ObjectMapper mapper, @Value("${app.seed-pattern}") String pattern) {
        this.service = service;
        this.categories = categories;
        this.topics = topics;
        this.lessons = lessons;
        this.mapper = mapper;
        this.pattern = pattern;
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

        int added = 0, order = 0;
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
                    if (lessons.findByTopicSlugAndSlug(t.slug(), l.slug()).isPresent()) continue;
                    service.upsertLesson(new LessonRequest(t.slug(), l.slug(), l.title(), i + 1, l.content()));
                    added++;
                }
            }
        }
        log.info("Seed sync from {} file(s): {} categories, {} new lessons", files.length, cats.size(), added);
    }
}
