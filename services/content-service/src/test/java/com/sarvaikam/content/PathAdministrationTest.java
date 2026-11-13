package com.sarvaikam.content;

import com.sarvaikam.content.api.PathController;
import com.sarvaikam.content.api.PathController.PathRequest;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PathAdministrationTest {
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final PathController controller = new PathController(db);
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    void admin() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "", List.of(new SimpleGrantedAuthority("content.manage"))));
    }
    PathRequest request(List<String> topics) {
        return new PathRequest("gen-ai", "Gen AI", "Build applications", "Description", "spark", "violet", 1, topics, List.of("Build a project"));
    }
    @Test void aUserWithoutPermissionCannotChangeThePath() {
        assertThrows(ResponseStatusException.class, () -> controller.save(request(List.of("python"))));
        verifyNoInteractions(db);
    }
    @Test void missingCourseIsRejectedBeforeChangingAnyPathMetadata() {
        admin();
        when(db.queryForObject(anyString(), eq(Boolean.class), eq("missing"))).thenReturn(false);
        assertThrows(ResponseStatusException.class, () -> controller.save(request(List.of("missing"))));
        verify(db, never()).update(anyString(), any(Object[].class));
    }
    @Test void duplicateCoursesAreRejectedBeforeDatabaseWrites() {
        admin();
        assertThrows(ResponseStatusException.class, () -> controller.save(request(List.of("python", "python"))));
        verifyNoInteractions(db);
    }
    @Test void chosenCourseSequenceIsStoredInTheRequestedOrder() {
        admin();
        when(db.queryForObject(anyString(), eq(Boolean.class), anyString())).thenReturn(true);
        controller.save(request(List.of("llms", "python")));
        var order = inOrder(db);
        order.verify(db).update(contains("INSERT INTO learning_paths"), eq("gen-ai"), eq("Gen AI"), eq("Build applications"), eq("Description"), eq("spark"), eq("violet"), eq(1));
        order.verify(db).update(contains("DELETE FROM learning_path_topics"), eq("gen-ai"));
        order.verify(db).update(contains("DELETE FROM learning_path_outcomes"), eq("gen-ai"));
        order.verify(db).update(contains("INSERT INTO learning_path_topics"), eq("gen-ai"), eq("llms"), eq(1));
        order.verify(db).update(contains("INSERT INTO learning_path_topics"), eq("gen-ai"), eq("python"), eq(2));
    }
}
