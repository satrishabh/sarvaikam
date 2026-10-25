package com.sarvaikam.content.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    Optional<Lesson> findByTopicSlugAndSlug(String topicSlug, String slug);
}
