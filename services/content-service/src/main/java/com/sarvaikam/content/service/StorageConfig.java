package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** STORAGE_BACKEND=gcs (default) keeps the bucket; STORAGE_BACKEND=drive stores everything in the owner's Google Drive. */
@Configuration
public class StorageConfig {
    @Bean
    ObjectStore objectStore(@Value("${STORAGE_BACKEND:gcs}") String backend,
                            @Value("${GCP_CONTENT_BUCKET:}") String bucket,
                            @Value("${GCP_SIGNING_SERVICE_ACCOUNT:}") String signingAccount,
                            @Value("${DRIVE_CLIENT_ID:}") String driveClientId,
                            @Value("${DRIVE_CLIENT_SECRET:}") String driveClientSecret,
                            @Value("${DRIVE_REFRESH_TOKEN:}") String driveRefreshToken,
                            @Value("${DRIVE_FOLDER_ID:}") String driveFolderId,
                            @Value("${DRIVE_FOLDER_NAME:Sarvaikam content}") String driveFolderName) {
        return switch (backend.trim().toLowerCase()) {
            case "gcs" -> new GcsObjectStore(bucket, signingAccount);
            case "drive" -> new DriveObjectStore(driveClientId, driveClientSecret, driveRefreshToken, driveFolderId, driveFolderName);
            default -> throw new IllegalStateException("STORAGE_BACKEND must be gcs or drive, not " + backend);
        };
    }
}
