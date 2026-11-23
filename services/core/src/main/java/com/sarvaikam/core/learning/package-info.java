/**
 * What each learner has completed and saved. It takes over the progress-service API at {@code /api/progress}
 * unchanged, so the gateway can route that prefix to the Core without any frontend change.
 *
 * <p>Other modules react to {@link com.sarvaikam.core.learning.LessonCompleted} and
 * {@link com.sarvaikam.core.learning.LessonReopened} instead of reading the tables. Mastery, the review queue and
 * the Skill Passport will be built on those events.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Learning")
package com.sarvaikam.core.learning;
