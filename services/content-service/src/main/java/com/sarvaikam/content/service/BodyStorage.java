package com.sarvaikam.content.service;

import com.google.cloud.storage.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Immutable object names keep failed database transactions from changing published content. */
@Service
public class BodyStorage {
    private final String bucket;
    private final AssetService assets;

    public BodyStorage(@Value("${GCP_CONTENT_BUCKET:}") String bucket, AssetService assets) { this.bucket = bucket; this.assets = assets; }
    public boolean enabled() { return !bucket.isBlank(); }
    private Storage client() { return assets.storage(); }
    public String write(String prefix, String body) {
        String object = prefix + "/" + UUID.randomUUID() + ".md";
        client().create(BlobInfo.newBuilder(bucket, object).setContentType("text/markdown; charset=utf-8").build(),
                body.getBytes(StandardCharsets.UTF_8), Storage.BlobTargetOption.doesNotExist());
        return object;
    }
    public String read(String object) {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Content bucket is not configured");
        Blob blob = client().get(bucket, object);
        if (blob == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Content body is unavailable");
        return new String(blob.getContent(), StandardCharsets.UTF_8);
    }
}
