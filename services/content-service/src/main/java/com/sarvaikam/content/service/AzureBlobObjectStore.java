package com.sarvaikam.content.service;

import com.azure.core.util.BinaryData;
import com.azure.core.util.Context;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.options.BlobParallelUploadOptions;
import com.azure.storage.blob.models.BlobProperties;
import com.azure.storage.blob.models.BlobRequestConditions;
import com.azure.storage.blob.models.BlobStorageException;
import com.azure.storage.blob.models.UserDelegationKey;
import com.azure.storage.blob.sas.BlobSasPermission;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Azure Blob Storage container. Authenticates with the pod's Azure identity (workload identity in AKS), so no
 * account key is stored. Browser uploads and downloads use short-lived user-delegation SAS URLs; downloads are
 * not proxied through the service. Writes never overwrite: uploads carry If-None-Match: *.
 *
 * The identity needs "Storage Blob Data Contributor" and "Storage Blob Delegator" on the account.
 */
public class AzureBlobObjectStore implements ObjectStore {
    static final Duration UPLOAD_TTL = Duration.ofMinutes(15);
    static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);

    private final BlobServiceClient service;
    private final BlobContainerClient container;

    AzureBlobObjectStore(BlobServiceClient service, String containerName) {
        this.service = service;
        this.container = service == null ? null : service.getBlobContainerClient(containerName);
    }

    /** Returns a disabled store when the account or container is not configured. Builds no network connection. */
    public static AzureBlobObjectStore create(String accountName, String containerName) {
        if (accountName == null || accountName.isBlank() || containerName == null || containerName.isBlank()) {
            return new AzureBlobObjectStore(null, "");
        }
        var service = new BlobServiceClientBuilder()
                .endpoint("https://" + accountName + ".blob.core.windows.net")
                .credential(new DefaultAzureCredentialBuilder().build())
                .buildClient();
        return new AzureBlobObjectStore(service, containerName);
    }

    public boolean enabled() { return container != null; }

    private void requireEnabled() {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured yet");
    }

    private BlobClient blob(String key) { return container.getBlobClient(key); }

    private UserDelegationKey cachedKey;

    /** One user-delegation key serves every SAS for ~25 minutes instead of a network call per link. */
    private synchronized UserDelegationKey delegationKey() {
        OffsetDateTime now = OffsetDateTime.now();
        if (cachedKey == null || cachedKey.getSignedExpiry() == null || cachedKey.getSignedExpiry().isBefore(now.plusMinutes(20))) {
            cachedKey = service.getUserDelegationKey(now.minusMinutes(5), now.plusMinutes(45));
        }
        return cachedKey;
    }

    public void create(String key, byte[] data, String contentType) {
        requireEnabled();
        try {
            blob(key).uploadWithResponse(new BlobParallelUploadOptions(BinaryData.fromBytes(data))
                    .setHeaders(new BlobHttpHeaders().setContentType(contentType))
                    .setRequestConditions(new BlobRequestConditions().setIfNoneMatch("*")), null, Context.NONE);
        } catch (BlobStorageException e) {
            if (e.getStatusCode() == 409 || e.getStatusCode() == 412) throw new IllegalStateException("object already exists: " + key, e);
            throw e;
        }
    }

    @Override
    public void createFrom(String key, InputStream in, long size, String contentType) {
        requireEnabled();
        try {
            blob(key).uploadWithResponse(new BlobParallelUploadOptions(BinaryData.fromStream(in, size))
                    .setHeaders(new BlobHttpHeaders().setContentType(contentType))
                    .setRequestConditions(new BlobRequestConditions().setIfNoneMatch("*")), null, Context.NONE);
        } catch (BlobStorageException e) {
            if (e.getStatusCode() == 409 || e.getStatusCode() == 412) throw new IllegalStateException("object already exists: " + key, e);
            throw e;
        }
    }

    public byte[] read(String key) {
        requireEnabled();
        try {
            return blob(key).downloadContent().toBytes();
        } catch (BlobStorageException e) {
            if (e.getStatusCode() == 404) return null;
            throw e;
        }
    }

    public Stat stat(String key) {
        requireEnabled();
        try {
            BlobProperties props = blob(key).getProperties();
            long version = props.getLastModified() == null ? 0L : props.getLastModified().toInstant().toEpochMilli();
            return new Stat(props.getBlobSize(), props.getContentType(), version);
        } catch (BlobStorageException e) {
            if (e.getStatusCode() == 404) return null;
            throw e;
        }
    }

    public void delete(String key) {
        requireEnabled();
        blob(key).deleteIfExists();
    }

    public UploadTicket uploadTicket(String key, String contentType, long size, String origin) {
        requireEnabled();
        BlobClient client = blob(key);
        String sas = client.generateUserDelegationSas(new BlobServiceSasSignatureValues(
                OffsetDateTime.now().plus(UPLOAD_TTL),
                // Create only: Write would let the link holder overwrite the blob after it was checked.
                new BlobSasPermission().setCreatePermission(true)), delegationKey());
        return new UploadTicket(client.getBlobUrl() + "?" + sas,
                Map.of("x-ms-blob-type", "BlockBlob", "Content-Type", contentType, "If-None-Match", "*"));
    }

    public String directDownloadUrl(String key, long version, String filename) {
        requireEnabled();
        BlobClient client = blob(key);
        String sas = client.generateUserDelegationSas(new BlobServiceSasSignatureValues(
                OffsetDateTime.now().plus(DOWNLOAD_TTL), new BlobSasPermission().setReadPermission(true))
                .setContentDisposition("attachment; filename=\"" + filename + "\""), delegationKey());
        return client.getBlobUrl() + "?" + sas;
    }

    public InputStream open(String key, long version) {
        requireEnabled();
        return blob(key).openInputStream();
    }
}
