package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Chooses the storage adapter named by STORAGE_BACKEND (default "gcs"). Adapters are discovered from every
 * {@link ObjectStoreProvider} bean, so a new cloud is added by implementing that interface.
 */
@Configuration
public class StorageConfig {
    @Bean
    ObjectStore objectStore(@Value("${STORAGE_BACKEND:gcs}") String backend, List<ObjectStoreProvider> providers) {
        return select(backend, providers).create();
    }

    static ObjectStoreProvider select(String backend, List<ObjectStoreProvider> providers) {
        String wanted = backend.trim().toLowerCase();
        return providers.stream()
                .filter(p -> p.name().equals(wanted))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("STORAGE_BACKEND must be one of "
                        + providers.stream().map(ObjectStoreProvider::name).sorted().collect(Collectors.joining(", "))
                        + ", not " + backend));
    }
}
