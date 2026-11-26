package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;

/** STORAGE_BACKEND=s3: Amazon S3 bucket named by S3_BUCKET, in AWS_REGION. */
@Component
class S3ObjectStoreProvider implements ObjectStoreProvider {
    private final String bucket;
    private final String region;

    S3ObjectStoreProvider(@Value("${S3_BUCKET:}") String bucket,
                          @Value("${AWS_REGION:ap-southeast-2}") String region) {
        this.bucket = bucket;
        this.region = region;
    }

    @Override public String name() { return "s3"; }

    @Override public ObjectStore create() { return S3ObjectStore.create(bucket, Region.of(region)); }
}
