package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.LessonRepository;
import com.sarvaikam.content.security.ContentAccess;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Short self-checks shown at the end of a lesson, from quick-checks.json ("topic/lesson" -> questions).
 * Authors write the correct option anywhere and point "answer" at it; options are served in a stable shuffled
 * order so the right answer is not always in the same place. Answers go to the client: this is practice, not a test.
 */
@Service
public class QuickChecks {
    public record Question(String question, List<String> options, int answer, String explain) {}

    private final Map<String, List<Question>> checks;
    private final LessonRepository lessons;

    public QuickChecks(LessonRepository lessons) throws IOException {
        this.lessons = lessons;
        try (InputStream in = new ClassPathResource("quick-checks.json").getInputStream()) {
            this.checks = load(in);
        }
    }

    static Map<String, List<Question>> load(InputStream in) throws IOException {
        Map<String, List<Question>> raw = new ObjectMapper().readValue(in, new TypeReference<>() {});
        raw.forEach((key, questions) -> {
            for (Question q : questions)
                if (q.options() == null || q.answer() < 0 || q.answer() >= q.options().size())
                    throw new IllegalStateException("quick-checks.json: bad answer index in " + key + ": " + q.question());
        });
        return Map.copyOf(raw);
    }

    Map<String, List<Question>> all() { return checks; }

    @Transactional(readOnly = true)
    public List<Question> forLesson(String topicSlug, String lessonSlug) {
        var lesson = lessons.findByTopicSlugAndSlug(topicSlug, lessonSlug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson " + lessonSlug + " not found"));
        ContentAccess.lesson(lesson.isExclusive());
        return checks.getOrDefault(topicSlug + "/" + lessonSlug, List.of()).stream().map(QuickChecks::shuffled).toList();
    }

    /** Same order for the same question every time, so a retry or reload shows the same layout. */
    static Question shuffled(Question q) {
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < q.options().size(); i++) order.add(i);
        Collections.shuffle(order, new Random(q.question().hashCode()));
        List<String> options = order.stream().map(q.options()::get).toList();
        return new Question(q.question(), options, order.indexOf(q.answer()), q.explain());
    }
}
