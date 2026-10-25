package com.sarvaikam.content.api;

import com.sarvaikam.content.api.Dtos.*;
import com.sarvaikam.content.service.ContentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ContentController {
    private final ContentService service;

    public ContentController(ContentService service) {
        this.service = service;
    }

    @GetMapping("/categories")
    public List<CategoryView> categories() { return service.listCategories(); }

    @GetMapping("/topics/{slug}")
    public TopicView topic(@PathVariable String slug) { return service.getTopic(slug); }

    @GetMapping("/topics/{topicSlug}/lessons/{lessonSlug}")
    public LessonView lesson(@PathVariable String topicSlug, @PathVariable String lessonSlug) {
        return service.getLesson(topicSlug, lessonSlug);
    }

    @GetMapping("/search")
    public List<TopicSummary> search(@RequestParam String q) { return service.search(q.trim()); }

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
