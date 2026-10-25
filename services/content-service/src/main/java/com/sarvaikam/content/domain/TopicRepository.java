package com.sarvaikam.content.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TopicRepository extends JpaRepository<Topic, Long> {
    Optional<Topic> findBySlug(String slug);
    List<Topic> findTop20ByNameContainingIgnoreCaseOrSummaryContainingIgnoreCase(String name, String summary);
}
