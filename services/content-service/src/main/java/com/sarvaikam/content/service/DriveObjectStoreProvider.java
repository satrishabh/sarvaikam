package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** STORAGE_BACKEND=drive: the owner's Google Drive, configured by the DRIVE_* settings. */
@Component
class DriveObjectStoreProvider implements ObjectStoreProvider {
    private final String clientId, clientSecret, refreshToken, folderId, folderName;

    DriveObjectStoreProvider(@Value("${DRIVE_CLIENT_ID:}") String clientId,
                             @Value("${DRIVE_CLIENT_SECRET:}") String clientSecret,
                             @Value("${DRIVE_REFRESH_TOKEN:}") String refreshToken,
                             @Value("${DRIVE_FOLDER_ID:}") String folderId,
                             @Value("${DRIVE_FOLDER_NAME:Sarvaikam content}") String folderName) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.refreshToken = refreshToken;
        this.folderId = folderId;
        this.folderName = folderName;
    }

    @Override public String name() { return "drive"; }

    @Override public ObjectStore create() {
        return new DriveObjectStore(clientId, clientSecret, refreshToken, folderId, folderName);
    }
}
