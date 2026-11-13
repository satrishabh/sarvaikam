package com.sarvaikam.content;

import com.sarvaikam.content.api.Dtos.LessonRequest;
import com.sarvaikam.content.domain.*;
import com.sarvaikam.content.service.*;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LearningStagesTest {
    private final CategoryRepository categories = mock(CategoryRepository.class);
    private final TopicRepository topics = mock(TopicRepository.class);
    private final LessonRepository lessons = mock(LessonRepository.class);
    private final ContentService service = new ContentService(categories, topics, lessons, mock(AssetService.class), mock(BodyStorage.class));

    private Lesson lesson(Topic topic, String slug, String stage, int step) {
        Lesson lesson = new Lesson();
        lesson.setTopic(topic); lesson.setSlug(slug); lesson.setTitle(slug);
        lesson.setStage(stage); lesson.setStepNumber(step);
        topic.getLessons().add(lesson);
        return lesson;
    }

    @Test void readerNavigationFollowsLearningLevelsEvenWhenLegacyStepsDoNot() {
        Topic topic = new Topic(); topic.setSlug("java"); topic.setName("Java");
        Category category = new Category(); category.setSlug("languages"); topic.setCategory(category);
        Lesson deep = lesson(topic, "internals", "DEEP_DIVE", 1);
        Lesson advanced = lesson(topic, "locks", "ADVANCED", 2);
        Lesson starter = lesson(topic, "setup", "STARTER", 3);
        when(topics.findBySlug("java")).thenReturn(Optional.of(topic));
        when(lessons.findByTopicSlugAndSlug("java", "locks")).thenReturn(Optional.of(advanced));
        var ordered = service.getTopic("java").lessons();
        assertEquals(java.util.List.of("setup", "locks", "internals"), ordered.stream().map(l -> l.slug()).toList());
        var view = service.getLesson("java", "locks");
        assertEquals(starter.getSlug(), view.previous().slug());
        assertEquals(deep.getSlug(), view.next().slug());
        assertEquals("ADVANCED", view.stage());
    }

    @Test void olderEditorsPreserveStageAndNewEditorsCanChangeIt() {
        Topic topic = new Topic();
        Lesson existing = lesson(topic, "locks", "ADVANCED", 1);
        when(topics.findBySlug("java")).thenReturn(Optional.of(topic));
        when(lessons.findByTopicSlugAndSlug("java", "locks")).thenReturn(Optional.of(existing));
        when(lessons.save(any(Lesson.class))).thenAnswer(call -> call.getArgument(0));
        service.upsertLesson(new LessonRequest("java", "locks", "Locks", 1, "Updated", false, null));
        assertEquals("ADVANCED", existing.getStage());
        service.upsertLesson(new LessonRequest("java", "locks", "Locks", 1, "Updated", false, "DEEP_DIVE"));
        assertEquals("DEEP_DIVE", existing.getStage());
    }
}
