package com.sarvaikam.content.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/** Private object storage for lesson bodies and attachments. Keys are immutable; content is never overwritten. */
public interface ObjectStore {
    record Stat(long size, String contentType, long version) {}
    record UploadTicket(String url, Map<String, String> headers) {}

    boolean enabled();
    /** Creates the object; fails if the key already exists. */
    void create(String key, byte[] data, String contentType);
    /**
     * Creates the object from a stream of exactly {@code size} bytes; fails if the key already exists.
     * Adapters that can stream override this; the default buffers and is limited to {@link #MAX_BUFFERED_BYTES}.
     */
    default void createFrom(String key, InputStream in, long size, String contentType) throws IOException {
        if (size > MAX_BUFFERED_BYTES)
            throw new IOException("This storage adapter cannot stream " + size + " bytes; the limit is " + MAX_BUFFERED_BYTES);
        create(key, in.readNBytes((int) size), contentType);
    }
    long MAX_BUFFERED_BYTES = 256L * 1024 * 1024;
    /** Returns the object bytes, or null when it does not exist. */
    byte[] read(String key);
    /** Returns size, type and version of a finished upload, or null when it does not exist. */
    Stat stat(String key);
    void delete(String key);
    /** A short-lived URL the browser PUTs the file to, with the headers it must send. */
    UploadTicket uploadTicket(String key, String contentType, long size, String origin);
    /** A short-lived URL the browser downloads from directly, or null when downloads stream through this service. */
    String directDownloadUrl(String key, long version, String filename);
    InputStream open(String key, long version) throws IOException;
}
