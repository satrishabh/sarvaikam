package com.sarvaikam.content;

import com.sarvaikam.content.seed.BodyMigration;
import com.sarvaikam.content.service.BodyStorage;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BodyMigrationTest {
    @Test void databaseBodyIsClearedOnlyAfterSuccessfulUploadAndWithConcurrencyGuard() {
        var db = mock(JdbcTemplate.class);
        var bodies = mock(BodyStorage.class);
        when(bodies.enabled()).thenReturn(true);
        when(db.queryForList(anyString())).thenReturn(List.of(Map.of("id", 7L, "content_md", "CMS edit")), List.of());
        when(bodies.write("lesson-bodies", "CMS edit")).thenReturn("lesson-bodies/version.md");
        new BodyMigration(db, bodies).run(null);
        var order = inOrder(bodies, db);
        order.verify(bodies).write("lesson-bodies", "CMS edit");
        order.verify(db).update(contains("AND content_md = ?"), eq("lesson-bodies/version.md"), eq(7L), eq("CMS edit"));
    }
    @Test void failedUploadLeavesDatabaseTextIntact() {
        var db = mock(JdbcTemplate.class);
        var bodies = mock(BodyStorage.class);
        when(bodies.enabled()).thenReturn(true);
        when(db.queryForList(anyString())).thenReturn(List.of(Map.of("id", 7L, "content_md", "CMS edit")));
        when(bodies.write(anyString(), anyString())).thenThrow(new IllegalStateException("offline"));
        assertThrows(IllegalStateException.class, () -> new BodyMigration(db, bodies).run(null));
        verify(db, never()).update(anyString(), any(Object[].class));
    }
    @Test void noBucketKeepsLocalDatabaseMode() {
        var db = mock(JdbcTemplate.class);
        new BodyMigration(db, mock(BodyStorage.class)).run(null);
        verifyNoInteractions(db);
    }
}
