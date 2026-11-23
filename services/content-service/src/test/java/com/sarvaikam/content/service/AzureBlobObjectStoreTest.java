package com.sarvaikam.content.service;

import com.azure.core.util.BinaryData;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import com.azure.storage.blob.models.BlobProperties;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.models.UserDelegationKey;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Runs the Azure Blob adapter against mocked Azure clients (no network, no account). */
class AzureBlobObjectStoreTest {
    private BlobServiceClient service;
    private BlobContainerClient container;
    private BlobClient blob;
    private AzureBlobObjectStore store;

    private void setUp() {
        service = mock(BlobServiceClient.class);
        container = mock(BlobContainerClient.class);
        blob = mock(BlobClient.class);
        when(service.getBlobContainerClient("content")).thenReturn(container);
        when(container.getBlobClient(anyString())).thenReturn(blob);
        store = new AzureBlobObjectStore(service, "content");
    }

    private static BlobStorageException status(int code) {
        BlobStorageException ex = mock(BlobStorageException.class);
        when(ex.getStatusCode()).thenReturn(code);
        return ex;
    }

    @Test
    void createRefusesToOverwriteExistingBlobs() {
        setUp();
        store.create("lesson-bodies/a.md", "hello".getBytes(), "text/markdown; charset=utf-8");

        ArgumentCaptor<BlobParallelUploadOptions> captor = ArgumentCaptor.forClass(BlobParallelUploadOptions.class);
        verify(blob).uploadWithResponse(captor.capture(), any(), any());
        assertEquals("*", captor.getValue().getRequestConditions().getIfNoneMatch());
        assertEquals("text/markdown; charset=utf-8", captor.getValue().getHeaders().getContentType());
    }

    @Test
    void createReportsAnExistingBlobAsAnError() {
        setUp();
        BlobStorageException conflict = status(409);
        when(blob.uploadWithResponse(any(BlobParallelUploadOptions.class), any(), any())).thenThrow(conflict);
        assertThrows(IllegalStateException.class, () -> store.create("k", new byte[]{1}, "text/plain"));
    }

    @Test
    void readReturnsBytesAndNullWhenMissing() {
        setUp();
        when(blob.downloadContent()).thenReturn(BinaryData.fromBytes("data".getBytes()));
        assertArrayEquals("data".getBytes(), store.read("k"));

        BlobStorageException notFound = status(404);
        when(blob.downloadContent()).thenThrow(notFound);
        assertNull(store.read("missing"));
    }

    @Test
    void statMapsSizeTypeAndVersionAndReturnsNullWhenMissing() {
        setUp();
        OffsetDateTime modified = OffsetDateTime.parse("2026-11-14T00:00:00Z");
        BlobProperties props = mock(BlobProperties.class);
        when(props.getBlobSize()).thenReturn(42L);
        when(props.getContentType()).thenReturn("text/markdown");
        when(props.getLastModified()).thenReturn(modified);
        when(blob.getProperties()).thenReturn(props);

        var stat = store.stat("k");
        assertEquals(42L, stat.size());
        assertEquals("text/markdown", stat.contentType());
        assertEquals(modified.toInstant().toEpochMilli(), stat.version());

        BlobStorageException notFound = status(404);
        when(blob.getProperties()).thenThrow(notFound);
        assertNull(store.stat("missing"));
    }

    @Test
    void uploadTicketIsASasForThisBlobAndRequiresNoOverwrite() {
        setUp();
        when(service.getUserDelegationKey(any(), any())).thenReturn(mock(UserDelegationKey.class));
        when(blob.generateUserDelegationSas(any(BlobServiceSasSignatureValues.class), any())).thenReturn("sv=2026&sig=SIGNED");
        when(blob.getBlobUrl()).thenReturn("https://acct.blob.core.windows.net/content/attachments/video.mp4");

        var ticket = store.uploadTicket("attachments/video.mp4", "video/mp4", 1024, "https://learn.sarvaikam.com");

        assertTrue(ticket.url().startsWith("https://acct.blob.core.windows.net/content/attachments/video.mp4?"), ticket.url());
        assertTrue(ticket.url().contains("sig=SIGNED"), ticket.url());
        assertEquals("BlockBlob", ticket.headers().get("x-ms-blob-type"));
        assertEquals("*", ticket.headers().get("If-None-Match"));
    }

    @Test
    void disabledWhenNoAccountIsConfiguredAndNothingIsContacted() {
        var disabled = AzureBlobObjectStore.create("", "content");
        assertFalse(disabled.enabled());
        var ex = assertThrows(ResponseStatusException.class, () -> disabled.read("k"));
        assertEquals("File storage is not configured yet", ex.getReason());
    }
}
