package com.sarvaikam.content.api;

import com.sarvaikam.content.api.Dtos.*;
import com.sarvaikam.content.service.ContentService;
import com.sarvaikam.content.service.LessonSearch;
import com.sarvaikam.content.service.QuickChecks;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ContentController {
    private final ContentService service;
    private final LessonSearch lessonSearch;
    private final QuickChecks quickChecks;

    public ContentController(ContentService service, LessonSearch lessonSearch, QuickChecks quickChecks) {
        this.service = service;
        this.lessonSearch = lessonSearch;
        this.quickChecks = quickChecks;
    }

    @GetMapping("/categories")
    public List<CategoryView> categories() { return service.listCategories(); }

    @GetMapping("/topics/{slug}")
    public TopicView topic(@PathVariable String slug) { return service.getTopic(slug); }

    @GetMapping("/topics/{topicSlug}/lessons/{lessonSlug}")
    public LessonView lesson(@PathVariable String topicSlug, @PathVariable String lessonSlug) {
        return service.getLesson(topicSlug, lessonSlug);
    }

    /** The lesson's quick check (empty when it has none), with the same access rules as the lesson. */
    @GetMapping("/topics/{topicSlug}/lessons/{lessonSlug}/quick-check")
    public List<QuickChecks.Question> quickCheck(@PathVariable String topicSlug, @PathVariable String lessonSlug) {
        return quickChecks.forLesson(topicSlug, lessonSlug);
    }

    @GetMapping("/search")
    public List<TopicSummary> search(@RequestParam String q) { return service.search(q.trim()); }

    /** Full-text search over lesson titles and bodies, best match first (at most 20). */
    @GetMapping("/search/lessons")
    public List<LessonSearch.Hit> searchLessons(@RequestParam(defaultValue = "") String q) { return lessonSearch.search(q); }

    @GetMapping("/lessons/{id}/access")
    public java.util.Map<String, Object> lessonAccess(@PathVariable long id, @RequestParam String topicSlug) {
        return service.validateLessonAccess(id, topicSlug);
    }

    // ---- admin (ROLE_ADMIN enforced in SecurityConfig) ----

    @PutMapping("/admin/categories")
    public CategoryView upsertCategory(@Valid @RequestBody CategoryRequest r) { return service.upsertCategory(r); }

    @PutMapping("/admin/topics")
    public TopicSummary upsertTopic(@Valid @RequestBody TopicRequest r) { return service.upsertTopic(r); }

    @PutMapping("/admin/lessons")
    public LessonSummary upsertLesson(@Valid @RequestBody LessonRequest r) { return service.upsertLesson(r); }

    @DeleteMapping("/admin/lessons/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLesson(@PathVariable Long id) { service.deleteLesson(id); }
}
