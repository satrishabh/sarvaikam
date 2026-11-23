package com.sarvaikam.core.learning;

import java.time.Instant;

/** A learner removed a completion mark. Published only when a mark existed. */
public record LessonReopened(String userId, long lessonId, Instant reopenedAt) {}
