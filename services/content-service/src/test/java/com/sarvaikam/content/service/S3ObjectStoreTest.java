package com.sarvaikam.content.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Runs the S3 adapter against a mocked S3 client and a real presigner with fixed test credentials (no network). */
class S3ObjectStoreTest {
    private static final String BUCKET = "sarvaikam-learn-test-bucket";
    private static final Region REGION = Region.AP_SOUTHEAST_2;

    private S3Client s3;
    private S3ObjectStore store;

    private void setUp() {
        s3 = mock(S3Client.class);
        S3Presigner presigner = S3Presigner.builder().region(REGION)
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("TESTKEY", "TESTSECRET")))
                .build();
        store = new S3ObjectStore(BUCKET, s3, presigner);
    }

    @Test
    void createUsesIfNoneMatchSoExistingKeysAreNeverOverwritten() {
        setUp();
        store.create("lesson-bodies/a.md", "hello".getBytes(), "text/markdown; charset=utf-8");

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3).putObject(captor.capture(), any(software.amazon.awssdk.core.sync.RequestBody.class));
        assertEquals(BUCKET, captor.getValue().bucket());
        assertEquals("lesson-bodies/a.md", captor.getValue().key());
        assertEquals("*", captor.getValue().ifNoneMatch());
    }

    @Test
    void createReportsAnExistingKeyAsAnError() {
        setUp();
        when(s3.putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
                .thenThrow(S3Exception.builder().statusCode(412).message("Precondition Failed").build());
        assertThrows(IllegalStateException.class, () -> store.create("k", new byte[]{1}, "text/plain"));
    }

    @Test
    void readReturnsBytesAndNullWhenMissing() {
        setUp();
        when(s3.getObjectAsBytes(any(software.amazon.awssdk.services.s3.model.GetObjectRequest.class)))
                .thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().build(), "data".getBytes()));
        assertArrayEquals("data".getBytes(), store.read("k"));

        when(s3.getObjectAsBytes(any(software.amazon.awssdk.services.s3.model.GetObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).build());
        assertNull(store.read("missing"));
    }

    @Test
    void statMapsSizeTypeAndVersionAndReturnsNullWhenMissing() {
        setUp();
        Instant modified = Instant.parse("2026-11-14T00:00:00Z");
        when(s3.headObject(any(software.amazon.awssdk.services.s3.model.HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().contentLength(42L).contentType("text/markdown")
                        .lastModified(modified).build());
        var stat = store.stat("k");
        assertEquals(42L, stat.size());
        assertEquals("text/markdown", stat.contentType());
        assertEquals(modified.toEpochMilli(), stat.version());

        when(s3.headObject(any(software.amazon.awssdk.services.s3.model.HeadObjectRequest.class)))
                .thenThrow(S3Exception.builder().statusCode(404).build());
        assertNull(store.stat("missing"));
    }

    @Test
    void uploadTicketIsPresignedForThisKeyAndRequiresNoOverwrite() {
        setUp();
        var ticket = store.uploadTicket("attachments/video.mp4", "video/mp4", 1024, "https://learn.sarvaikam.com");

        assertTrue(ticket.url().contains("attachments/video.mp4"), ticket.url());
        assertTrue(ticket.url().contains("X-Amz-Signature="), ticket.url());
        assertTrue(ticket.url().contains("X-Amz-Expires=900"), ticket.url());
        assertEquals("video/mp4", ticket.headers().get("Content-Type"));
        assertEquals("*", ticket.headers().get("If-None-Match"));
    }

    @Test
    void downloadTicketIsPresignedWithAttachmentFilename() {
        setUp();
        String url = store.directDownloadUrl("attachments/notes.pdf", 1L, "notes.pdf");

        assertTrue(url.contains("attachments/notes.pdf"), url);
        assertTrue(url.contains("X-Amz-Expires=300"), url);
        assertTrue(url.contains("response-content-disposition="), url);
    }

    @Test
    void everyOperationFailsClearlyWhenTheBucketIsNotConfigured() {
        s3 = mock(S3Client.class);
        store = new S3ObjectStore("", s3, S3Presigner.builder().region(REGION)
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("a", "b"))).build());
        assertFalse(store.enabled());
        var ex = assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> store.read("k"));
        assertEquals("File storage is not configured yet", ex.getReason());
        verifyNoInteractions(s3);
    }
}
