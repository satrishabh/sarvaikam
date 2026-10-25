package com.sarvaikam.content.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "lessons")
public class Lesson {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id")
    private Topic topic;

    private String slug;
    private String title;
    private int stepNumber;

    @Column(name = "content_md", columnDefinition = "TEXT")
    private String contentMd;

    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    void touch() { updatedAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public Topic getTopic() { return topic; }
    public void setTopic(Topic topic) { this.topic = topic; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getStepNumber() { return stepNumber; }
    public void setStepNumber(int stepNumber) { this.stepNumber = stepNumber; }
    public String getContentMd() { return contentMd; }
    public void setContentMd(String contentMd) { this.contentMd = contentMd; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
