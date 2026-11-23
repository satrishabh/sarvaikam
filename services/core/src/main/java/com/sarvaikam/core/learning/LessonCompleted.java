package com.sarvaikam.core.learning;

import java.time.Instant;

/** A learner marked a lesson complete for the first time. Not published again for a repeated request. */
public record LessonCompleted(String userId, long lessonId, String topicSlug, Instant completedAt) {}
