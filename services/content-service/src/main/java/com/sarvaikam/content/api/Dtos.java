package com.sarvaikam.content.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public final class Dtos {
    private Dtos() {}

    public record TopicSummary(Long id, String slug, String name, String summary, String level,
                               String categorySlug, int lessonCount) {}

    public record CategoryView(Long id, String slug, String name, String description, String icon,
                               List<TopicSummary> topics) {}

    public record LessonSummary(Long id, String slug, String title, int stepNumber) {}

    public record TopicView(Long id, String slug, String name, String summary, String level,
                            String categorySlug, String categoryName, List<LessonSummary> lessons) {}

    public record LessonView(Long id, String slug, String title, int stepNumber, String contentMd,
                             String topicSlug, String topicName, int totalSteps,
                             LessonSummary previous, LessonSummary next) {}

    private static final String SLUG = "^[a-z0-9]+(-[a-z0-9]+)*$";

    public record CategoryRequest(@NotBlank @Pattern(regexp = SLUG) String slug, @NotBlank String name,
                                  String description, String icon, int sortOrder) {}

    public record TopicRequest(@NotBlank String categorySlug, @NotBlank @Pattern(regexp = SLUG) String slug,
                               @NotBlank String name, String summary,
                               @Pattern(regexp = "BEGINNER|INTERMEDIATE|ADVANCED") String level, int sortOrder) {}

    public record LessonRequest(@NotBlank String topicSlug, @NotBlank @Pattern(regexp = SLUG) String slug,
                                @NotBlank String title, @Min(1) int stepNumber, @NotBlank String contentMd) {}
}
