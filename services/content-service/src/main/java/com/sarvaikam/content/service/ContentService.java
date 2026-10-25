package com.sarvaikam.content.service;

import com.sarvaikam.content.api.Dtos.*;
import com.sarvaikam.content.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ContentService {
    private final CategoryRepository categories;
    private final TopicRepository topics;
    private final LessonRepository lessons;

    public ContentService(CategoryRepository categories, TopicRepository topics, LessonRepository lessons) {
        this.categories = categories;
        this.topics = topics;
        this.lessons = lessons;
    }

    @Transactional(readOnly = true)
    public List<CategoryView> listCategories() {
        return categories.findAllByOrderBySortOrderAsc().stream()
                .map(c -> new CategoryView(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getIcon(),
                        c.getTopics().stream().map(ContentService::summary).toList()))
                .toList();
    }

    @Transactional(readOnly = true)
    public TopicView getTopic(String slug) {
        Topic t = topics.findBySlug(slug).orElseThrow(() -> notFound("Topic " + slug));
        return new TopicView(t.getId(), t.getSlug(), t.getName(), t.getSummary(), t.getLevel(),
                t.getCategory().getSlug(), t.getCategory().getName(),
                t.getLessons().stream().map(ContentService::summary).toList());
    }

    @Transactional(readOnly = true)
    public LessonView getLesson(String topicSlug, String lessonSlug) {
        Lesson l = lessons.findByTopicSlugAndSlug(topicSlug, lessonSlug)
                .orElseThrow(() -> notFound("Lesson " + lessonSlug));
        List<Lesson> all = l.getTopic().getLessons();
        int idx = all.indexOf(l);
        LessonSummary prev = idx > 0 ? summary(all.get(idx - 1)) : null;
        LessonSummary next = idx >= 0 && idx < all.size() - 1 ? summary(all.get(idx + 1)) : null;
        return new LessonView(l.getId(), l.getSlug(), l.getTitle(), l.getStepNumber(), l.getContentMd(),
                topicSlug, l.getTopic().getName(), all.size(), prev, next);
    }

    @Transactional(readOnly = true)
    public List<TopicSummary> search(String q) {
        return topics.findTop20ByNameContainingIgnoreCaseOrSummaryContainingIgnoreCase(q, q).stream()
                .map(ContentService::summary).toList();
    }

    @Transactional
    public CategoryView upsertCategory(CategoryRequest r) {
        Category c = categories.findBySlug(r.slug()).orElseGet(Category::new);
        c.setSlug(r.slug());
        c.setName(r.name());
        c.setDescription(r.description());
        c.setIcon(r.icon());
        c.setSortOrder(r.sortOrder());
        categories.save(c);
        return new CategoryView(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getIcon(), List.of());
    }

    @Transactional
    public TopicSummary upsertTopic(TopicRequest r) {
        Category c = categories.findBySlug(r.categorySlug()).orElseThrow(() -> notFound("Category " + r.categorySlug()));
        Topic t = topics.findBySlug(r.slug()).orElseGet(Topic::new);
        t.setCategory(c);
        t.setSlug(r.slug());
        t.setName(r.name());
        t.setSummary(r.summary());
        t.setLevel(r.level() == null ? "BEGINNER" : r.level());
        t.setSortOrder(r.sortOrder());
        return summary(topics.save(t));
    }

    @Transactional
    public LessonSummary upsertLesson(LessonRequest r) {
        Topic t = topics.findBySlug(r.topicSlug()).orElseThrow(() -> notFound("Topic " + r.topicSlug()));
        Lesson l = lessons.findByTopicSlugAndSlug(r.topicSlug(), r.slug()).orElseGet(Lesson::new);
        l.setTopic(t);
        l.setSlug(r.slug());
        l.setTitle(r.title());
        l.setStepNumber(r.stepNumber());
        l.setContentMd(r.contentMd());
        return summary(lessons.save(l));
    }

    @Transactional
    public void deleteLesson(Long id) {
        if (!lessons.existsById(id)) throw notFound("Lesson " + id);
        lessons.deleteById(id);
    }

    private static TopicSummary summary(Topic t) {
        return new TopicSummary(t.getId(), t.getSlug(), t.getName(), t.getSummary(), t.getLevel(),
                t.getCategory().getSlug(), t.getLessons().size());
    }

    private static LessonSummary summary(Lesson l) {
        return new LessonSummary(l.getId(), l.getSlug(), l.getTitle(), l.getStepNumber());
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
