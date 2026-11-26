package com.sarvaikam.content.service;

/**
 * Adapter registration point. Each cloud or storage product provides one implementation and is selected by
 * STORAGE_BACKEND=<name>. Application code depends only on {@link ObjectStore}, so moving to another cloud means
 * adding a provider and changing environment settings, not editing content, access or API code.
 */
public interface ObjectStoreProvider {
    /** Lower-case value of STORAGE_BACKEND that selects this adapter, for example "gcs", "drive" or "azure-blob". */
    String name();

    /** Builds the adapter from its own configuration. Must not perform network calls. */
    ObjectStore create();
}
