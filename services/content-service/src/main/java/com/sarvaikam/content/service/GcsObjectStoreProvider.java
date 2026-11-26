package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** STORAGE_BACKEND=gcs: Google Cloud Storage bucket configured by GCP_CONTENT_BUCKET. */
@Component
class GcsObjectStoreProvider implements ObjectStoreProvider {
    private final String bucket;
    private final String signingAccount;

    GcsObjectStoreProvider(@Value("${GCP_CONTENT_BUCKET:}") String bucket,
                           @Value("${GCP_SIGNING_SERVICE_ACCOUNT:}") String signingAccount) {
        this.bucket = bucket;
        this.signingAccount = signingAccount;
    }

    @Override public String name() { return "gcs"; }

    @Override public ObjectStore create() { return new GcsObjectStore(bucket, signingAccount); }
}
