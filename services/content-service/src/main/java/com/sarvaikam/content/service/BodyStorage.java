package com.sarvaikam.content.service;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Immutable object names keep failed database transactions from changing published content. */
@Service
public class BodyStorage {
    private final ObjectStore store;

    public BodyStorage(ObjectStore store) { this.store = store; }
    public boolean enabled() { return store.enabled(); }
    public String write(String prefix, String body) {
        String object = prefix + "/" + UUID.randomUUID() + ".md";
        store.create(object, body.getBytes(StandardCharsets.UTF_8), "text/markdown; charset=utf-8");
        return object;
    }
    public String read(String object) {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Content storage is not configured");
        byte[] body = store.read(object);
        if (body == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Content body is unavailable");
        return new String(body, StandardCharsets.UTF_8);
    }
}
