package com.sarvaikam.content.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ImpersonatedCredentials;
import com.google.cloud.storage.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.nio.channels.Channels;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Google Cloud Storage bucket; the browser uploads and downloads through V4 signed URLs. */
public class GcsObjectStore implements ObjectStore {
    private final String bucket;
    private final String signingAccount;
    private Storage storage;

    public GcsObjectStore(String bucket, String signingAccount) { this.bucket = bucket; this.signingAccount = signingAccount; }

    synchronized Storage storage() {
        if (bucket.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured yet");
        if (storage == null) {
            try {
                var options = StorageOptions.newBuilder();
                if (!signingAccount.isBlank()) options.setCredentials(ImpersonatedCredentials.create(
                        GoogleCredentials.getApplicationDefault(), signingAccount, null,
                        List.of("https://www.googleapis.com/auth/devstorage.read_write"), 300));
                storage = options.build().getService();
            } catch (java.io.IOException e) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage credentials are unavailable");
            }
        }
        return storage;
    }

    public boolean enabled() { return !bucket.isBlank(); }

    public void create(String key, byte[] data, String contentType) {
        storage().create(BlobInfo.newBuilder(bucket, key).setContentType(contentType).build(), data, Storage.BlobTargetOption.doesNotExist());
    }

    public byte[] read(String key) {
        Blob blob = storage().get(bucket, key);
        return blob == null ? null : blob.getContent();
    }

    public Stat stat(String key) {
        Blob blob = storage().get(bucket, key);
        return blob == null ? null : new Stat(blob.getSize(), blob.getContentType(), blob.getGeneration());
    }

    public void delete(String key) { storage().delete(BlobId.of(bucket, key)); }

    public UploadTicket uploadTicket(String key, String contentType, long size, String origin) {
        BlobInfo info = BlobInfo.newBuilder(bucket, key).setContentType(contentType).build();
        String url = storage().signUrl(info, 15, TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(), Storage.SignUrlOption.withContentType(),
                Storage.SignUrlOption.withExtHeaders(Map.of("content-length", Long.toString(size), "content-type", contentType)),
                Storage.SignUrlOption.withQueryParams(Map.of("ifGenerationMatch", "0"))).toString();
        return new UploadTicket(url, Map.of("Content-Type", contentType));
    }

    public String directDownloadUrl(String key, long version, String filename) {
        return storage().signUrl(BlobInfo.newBuilder(bucket, key).build(), 5, TimeUnit.MINUTES,
                Storage.SignUrlOption.withV4Signature(), Storage.SignUrlOption.withQueryParams(Map.of(
                        "generation", Long.toString(version), "response-content-disposition", "attachment; filename=\"" + filename + "\""))).toString();
    }

    public InputStream open(String key, long version) {
        return Channels.newInputStream(storage().reader(BlobId.of(bucket, key, version)));
    }
}
