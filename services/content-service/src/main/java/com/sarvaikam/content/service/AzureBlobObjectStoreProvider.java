package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** STORAGE_BACKEND=azure-blob: container AZURE_STORAGE_CONTAINER in storage account AZURE_STORAGE_ACCOUNT. */
@Component
class AzureBlobObjectStoreProvider implements ObjectStoreProvider {
    private final String account;
    private final String container;

    AzureBlobObjectStoreProvider(@Value("${AZURE_STORAGE_ACCOUNT:}") String account,
                                 @Value("${AZURE_STORAGE_CONTAINER:content}") String container) {
        this.account = account;
        this.container = container;
    }

    @Override public String name() { return "azure-blob"; }

    @Override public ObjectStore create() { return AzureBlobObjectStore.create(account, container); }
}
