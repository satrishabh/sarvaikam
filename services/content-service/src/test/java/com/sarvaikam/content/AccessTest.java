package com.sarvaikam.content;

import com.sarvaikam.content.domain.*;
import com.sarvaikam.content.security.ContentAccess;
import com.sarvaikam.content.service.AssetService;
import com.sarvaikam.content.service.ContentService;
import com.sarvaikam.content.service.BodyStorage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Optional;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.storage.StorageOptions;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccessTest {
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    void permissions(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("user", null,
                java.util.Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }
    @Test void publicLessonsRemainPublic() { assertDoesNotThrow(() -> ContentAccess.lesson(false)); }
    @Test void exclusiveLessonsRejectAnonymousAndNormalUsers() {
        assertThrows(ResponseStatusException.class, () -> ContentAccess.lesson(true));
        permissions("assets.download");
        assertThrows(ResponseStatusException.class, () -> ContentAccess.lesson(true));
    }
    @Test void businessPermissionGrantsExclusiveAccess() {
        permissions("content.exclusive"); assertDoesNotThrow(() -> ContentAccess.lesson(true));
    }
    @Test void contentManagersCanEditExclusiveLessons() {
        permissions("content.manage"); assertDoesNotThrow(() -> ContentAccess.lesson(true));
    }
    @Test void jwtRoleAloneDoesNotGrantExclusiveAccess() {
        permissions("ROLE_BUSINESS"); assertThrows(ResponseStatusException.class, () -> ContentAccess.lesson(true));
    }
    @Test void unauthorizedRequestCannotRetrieveLessonBody() {
        var lessons = mock(LessonRepository.class);
        var lesson = new Lesson(); lesson.setExclusive(true); lesson.setContentMd("private lesson body");
        when(lessons.findByTopicSlugAndSlug("topic", "lesson")).thenReturn(Optional.of(lesson));
        var service = new ContentService(mock(CategoryRepository.class), mock(TopicRepository.class), lessons, mock(AssetService.class), mock(BodyStorage.class));
        assertThrows(ResponseStatusException.class, () -> service.getLesson("topic", "lesson"));
    }
    @Test void exclusiveResourceListChecksLessonAccessBeforeReadingMetadata() {
        var lessons = mock(LessonRepository.class);
        var db = mock(JdbcTemplate.class);
        var lesson = new Lesson(); lesson.setExclusive(true);
        when(lessons.findById(1L)).thenReturn(Optional.of(lesson));
        var service = new AssetService(db, lessons, "bucket", 100, "");
        assertThrows(ResponseStatusException.class, () -> service.list(1L));
        verifyNoInteractions(db);
    }
    @Test void oversizedUploadsAndPathFilenamesAreRejectedBeforeStorage() {
        permissions("content.manage");
        var lessons = mock(LessonRepository.class);
        when(lessons.findById(1L)).thenReturn(Optional.of(new Lesson()));
        var service = new AssetService(mock(JdbcTemplate.class), lessons, "bucket", 100, "");
        assertThrows(ResponseStatusException.class, () -> service.upload(1, new AssetService.UploadRequest("file.zip", "application/zip", 101)));
        assertThrows(ResponseStatusException.class, () -> service.upload(1, new AssetService.UploadRequest("../secret.zip", "application/zip", 10)));
        assertThrows(ResponseStatusException.class, () -> service.upload(1, new AssetService.UploadRequest("bad\nfile.zip", "application/zip", 10)));
    }
    @Test void downloadsAlwaysRequireDownloadPermission() {
        var db = mock(JdbcTemplate.class);
        var service = new AssetService(db, mock(LessonRepository.class), "bucket", 100, "");
        assertThrows(ResponseStatusException.class, () -> service.download(java.util.UUID.randomUUID()));
        verifyNoInteractions(db);
    }
    @Test void uploadUrlBindsLengthTypeAndCreateOnlyPrecondition() throws Exception {
        permissions("content.manage");
        var lessons = mock(LessonRepository.class);
        when(lessons.findById(1L)).thenReturn(Optional.of(new Lesson()));
        var service = new AssetService(mock(JdbcTemplate.class), lessons, "private-content", 100, "");
        var keys = java.security.KeyPairGenerator.getInstance("RSA"); keys.initialize(2048);
        var credentials = ServiceAccountCredentials.newBuilder()
                .setClientId("test-client").setClientEmail("test@example.iam.gserviceaccount.com")
                .setPrivateKey(keys.generateKeyPair().getPrivate()).setPrivateKeyId("test-key").build();
        var field = AssetService.class.getDeclaredField("storage"); field.setAccessible(true);
        field.set(service, StorageOptions.newBuilder().setCredentials(credentials).build().getService());
        var upload = service.upload(1, new AssetService.UploadRequest("guide.pdf", "application/pdf", 42));
        String query = java.net.URLDecoder.decode(java.net.URI.create(upload.url()).getRawQuery(), java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(query.contains("X-Goog-SignedHeaders=content-length;content-type;host"), query);
        assertTrue(query.contains("ifGenerationMatch=0"));
        assertTrue(query.contains("X-Goog-Expires=900"));
        assertEquals("application/pdf", upload.headers().get("Content-Type"));
        assertFalse(upload.url().contains("guide.pdf"));
    }
}
