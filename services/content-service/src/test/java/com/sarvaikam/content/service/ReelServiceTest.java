package com.sarvaikam.content.service;

import com.sarvaikam.content.domain.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ReelServiceTest {
    final LessonRepository lessons = mock(LessonRepository.class);
    final BodyStorage bodies = mock(BodyStorage.class);
    final JdbcTemplate db = mock(JdbcTemplate.class);
    final ReelService service = new ReelService(lessons, bodies, db);
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    Map<String,Object> row(String slug, String lesson) {
        return Map.of("slug", slug, "course_slug", "java", "lesson_slug", lesson, "heading", "Heading",
            "content", "Body", "source_name", "Source", "source_url", "https://example.com", "published", true);
    }
    void admin() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "", List.of(new SimpleGrantedAuthority("content.manage"))));
    }
    @Test void exclusiveAndDeletedLessonsAreFilteredBeforePagination() {
        var topic = new Topic(); topic.setSlug("java"); topic.setName("Java");
        var exclusive = new Lesson(); exclusive.setTopic(topic); exclusive.setExclusive(true);
        var publicLesson = new Lesson(); publicLesson.setTopic(topic); publicLesson.setSlug("public"); publicLesson.setStepNumber(8);
        when(lessons.findByTopicSlugAndSlug("java", "exclusive")).thenReturn(Optional.of(exclusive));
        when(lessons.findByTopicSlugAndSlug("java", "deleted")).thenReturn(Optional.empty());
        when(lessons.findByTopicSlugAndSlug("java", "public")).thenReturn(Optional.of(publicLesson));
        when(db.queryForList(anyString())).thenReturn(List.of(row("a", "exclusive"), row("b", "deleted"), row("c", "public")));
        var feed = service.list(false, 1, 0);
        assertEquals(1, feed.size()); assertEquals("c", feed.getFirst().slug()); assertEquals(8, feed.getFirst().step());
        verify(db).queryForList(contains("WHERE published = true"));
    }
    @Test void writesRequirePermission() {
        assertThrows(ResponseStatusException.class, () -> service.save(null));
        assertThrows(ResponseStatusException.class, () -> service.list(true, 20, 0));
        verifyNoInteractions(db, bodies);
    }
    @Test void sourceAndLessonAreValidatedBeforeUpload() {
        admin();
        when(lessons.findByTopicSlugAndSlug(anyString(), anyString())).thenReturn(Optional.of(new Lesson()));
        var bad = new ReelService.ReelRequest("a", "java", "one", "Heading", "Body", "Source", "https://user:pass@example.com", true);
        assertThrows(ResponseStatusException.class, () -> service.save(bad));
        verifyNoInteractions(bodies, db);
    }
    @Test void bucketBodyAndSourceMetadataAreWrittenSeparately() {
        admin();
        when(lessons.findByTopicSlugAndSlug("java", "one")).thenReturn(Optional.of(new Lesson()));
        when(bodies.enabled()).thenReturn(true);
        when(bodies.write("reel-bodies", "Body")).thenReturn("reel-bodies/id.md");
        service.save(new ReelService.ReelRequest("a", "java", "one", "Heading", "Body", "Source", "https://example.com", false));
        verify(db).update(contains("ON CONFLICT"), eq("a"), eq("java"), eq("one"), eq("Heading"), isNull(), eq("reel-bodies/id.md"), eq("Source"), eq("https://example.com"), eq(false));
    }
}
