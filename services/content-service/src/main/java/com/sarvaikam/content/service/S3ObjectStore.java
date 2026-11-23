package com.sarvaikam.content.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Map;

/**
 * Amazon S3 bucket. Credentials come from the AWS default chain (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 * environment variables in the cluster). Uploads and downloads go straight to S3 through presigned URLs.
 * Keys are immutable and uploads use If-None-Match, so an existing object is never overwritten.
 */
public class S3ObjectStore implements ObjectStore {
    static final Duration UPLOAD_TTL = Duration.ofMinutes(15);
    static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);

    private final String bucket;
    private final S3Client s3;
    private final S3Presigner presigner;

    S3ObjectStore(String bucket, S3Client s3, S3Presigner presigner) {
        this.bucket = bucket;
        this.s3 = s3;
        this.presigner = presigner;
    }

    public static S3ObjectStore create(String bucket, Region region) {
        return new S3ObjectStore(bucket,
                S3Client.builder().region(region).credentialsProvider(DefaultCredentialsProvider.builder().build()).build(),
                S3Presigner.builder().region(region).credentialsProvider(DefaultCredentialsProvider.builder().build()).build());
    }

    public boolean enabled() { return !bucket.isBlank(); }

    private void requireEnabled() {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured yet");
    }

    public void create(String key, byte[] data, String contentType) {
        requireEnabled();
        try {
            s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).ifNoneMatch("*").build(),
                    RequestBody.fromBytes(data));
        } catch (S3Exception e) {
            if (e.statusCode() == 412 || e.statusCode() == 409) throw new IllegalStateException("object already exists: " + key, e);
            throw e;
        }
    }

    @Override
    public void createFrom(String key, InputStream in, long size, String contentType) {
        requireEnabled();
        try {
            s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).contentLength(size).ifNoneMatch("*").build(),
                    RequestBody.fromInputStream(in, size));
        } catch (S3Exception e) {
            if (e.statusCode() == 412 || e.statusCode() == 409) throw new IllegalStateException("object already exists: " + key, e);
            throw e;
        }
    }

    public byte[] read(String key) {
        requireEnabled();
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return null;
            throw e;
        }
    }

    public Stat stat(String key) {
        requireEnabled();
        try {
            HeadObjectResponse head = s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
            long version = head.lastModified() == null ? 0L : head.lastModified().toEpochMilli();
            return new Stat(head.contentLength(), head.contentType(), version);
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return null;
            throw e;
        }
    }

    public void delete(String key) {
        requireEnabled();
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    public UploadTicket uploadTicket(String key, String contentType, long size, String origin) {
        requireEnabled();
        PutObjectRequest put = PutObjectRequest.builder().bucket(bucket).key(key)
                .contentType(contentType).contentLength(size).ifNoneMatch("*").build();
        String url = presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(UPLOAD_TTL).putObjectRequest(put).build()).url().toString();
        return new UploadTicket(url, Map.of("Content-Type", contentType, "If-None-Match", "*"));
    }

    public String directDownloadUrl(String key, long version, String filename) {
        requireEnabled();
        GetObjectRequest get = GetObjectRequest.builder().bucket(bucket).key(key)
                .responseContentDisposition("attachment; filename=\"" + filename + "\"").build();
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(DOWNLOAD_TTL).getObjectRequest(get).build()).url().toString();
    }

    public InputStream open(String key, long version) throws IOException {
        requireEnabled();
        return s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
    }
}
