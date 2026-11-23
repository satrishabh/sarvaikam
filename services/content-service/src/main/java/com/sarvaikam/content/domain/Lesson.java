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

    private String contentObject;

    /** Plain text of the body for full-text search (V8); search_vector is generated from it by Postgres. */
    @Column(name = "search_text", columnDefinition = "TEXT")
    private String searchText;
    public void setSearchText(String searchText) { this.searchText = searchText; }
    public String getContentObject() { return contentObject; }
    public void setContentObject(String contentObject) { this.contentObject = contentObject; }

    private boolean exclusive;

    private String stage = "STARTER";

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
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public boolean isExclusive() { return exclusive; }
    public void setExclusive(boolean exclusive) { this.exclusive = exclusive; }
    public void setContentMd(String contentMd) { this.contentMd = contentMd; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
