package com.sarvaikam.core.learning.internal;

import com.sarvaikam.core.learning.LessonCompleted;
import com.sarvaikam.core.learning.LessonReopened;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Writes that other modules care about. Each change and its event commit in one transaction; Spring Modulith
 * stores the event for every listener in that transaction (the outbox), so a listener never misses a completion.
 */
@Service
class Progress {
    private final ProgressStore store;
    private final ApplicationEventPublisher events;

    Progress(ProgressStore store, ApplicationEventPublisher events) {
        this.store = store;
        this.events = events;
    }

    @Transactional
    void complete(UUID user, long lessonId, String topicSlug) {
        var completedAt = store.complete(user, lessonId, topicSlug);
        if (completedAt != null)
            events.publishEvent(new LessonCompleted(user.toString(), lessonId, topicSlug, completedAt.toInstant()));
    }

    @Transactional
    void uncomplete(UUID user, long lessonId) {
        if (store.uncomplete(user, lessonId))
            events.publishEvent(new LessonReopened(user.toString(), lessonId, Instant.now()));
    }
}
