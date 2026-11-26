package com.sarvaikam.content.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Verifies the adapter registry and the cloud-neutral migration path, using an in-memory store. */
class ObjectStoreAdapterTest {

    /** Minimal adapter used to exercise the port without any cloud SDK. */
    static class MemoryStore implements ObjectStore {
        final Map<String, byte[]> objects = new HashMap<>();
        final Map<String, String> types = new HashMap<>();
        boolean corruptOnWrite;

        public boolean enabled() { return true; }
        public void create(String key, byte[] data, String contentType) {
            if (objects.containsKey(key)) throw new IllegalStateException("exists: " + key);
            objects.put(key, corruptOnWrite ? new byte[Math.max(0, data.length - 1)] : data.clone());
            types.put(key, contentType);
        }
        public byte[] read(String key) { return objects.get(key); }
        public Stat stat(String key) {
            byte[] b = objects.get(key);
            return b == null ? null : new Stat(b.length, types.get(key), 1L);
        }
        public void delete(String key) { objects.remove(key); }
        public UploadTicket uploadTicket(String key, String contentType, long size, String origin) { throw new UnsupportedOperationException(); }
        public String directDownloadUrl(String key, long version, String filename) { return null; }
        public InputStream open(String key, long version) throws IOException { return new ByteArrayInputStream(read(key)); }
    }

    static class FakeProvider implements ObjectStoreProvider {
        private final String name;
        FakeProvider(String name) { this.name = name; }
        public String name() { return name; }
        public ObjectStore create() { return new MemoryStore(); }
    }

    @Test
    void selectsTheProviderNamedByConfiguration() {
        var gcs = new FakeProvider("gcs");
        var azure = new FakeProvider("azure-blob");
        assertSame(azure, StorageConfig.select(" Azure-Blob ", List.of(gcs, azure)));
    }

    @Test
    void unknownBackendFailsWithTheAvailableNames() {
        var ex = assertThrows(IllegalStateException.class,
                () -> StorageConfig.select("s3", List.of(new FakeProvider("gcs"), new FakeProvider("drive"))));
        assertTrue(ex.getMessage().contains("drive, gcs"), ex.getMessage());
    }

    @Test
    void migratesEveryObjectUnderItsOriginalKey() {
        var source = new MemoryStore();
        source.create("lesson-bodies/a.md", "one".getBytes(), "text/markdown");
        source.create("lesson-bodies/b.md", "two two".getBytes(), "text/markdown");
        var target = new MemoryStore();

        var report = ObjectStoreMigrator.copy(source, target, List.of("lesson-bodies/a.md", "lesson-bodies/b.md"));

        assertTrue(report.ok());
        assertEquals(2, report.copied());
        assertArrayEquals("two two".getBytes(), target.read("lesson-bodies/b.md"));
        assertEquals("text/markdown", target.stat("lesson-bodies/a.md").contentType());
    }

    @Test
    void rerunningSkipsObjectsAlreadyCopied() {
        var source = new MemoryStore();
        source.create("k", "data".getBytes(), "text/plain");
        var target = new MemoryStore();
        ObjectStoreMigrator.copy(source, target, List.of("k"));

        var second = ObjectStoreMigrator.copy(source, target, List.of("k"));

        assertEquals(0, second.copied());
        assertEquals(1, second.skipped());
        assertTrue(second.ok());
    }

    @Test
    void reportsMissingSourceObjectsWithoutStopping() {
        var source = new MemoryStore();
        source.create("present", "x".getBytes(), "text/plain");
        var target = new MemoryStore();

        var report = ObjectStoreMigrator.copy(source, target, List.of("absent", "present"));

        assertEquals(List.of("absent"), report.missing());
        assertEquals(1, report.copied());
        assertFalse(report.ok());
    }

    @Test
    void detectsWritesThatDoNotMatchTheSource() {
        var source = new MemoryStore();
        source.create("k", "abcdef".getBytes(), "text/plain");
        var target = new MemoryStore();
        target.corruptOnWrite = true;

        var report = ObjectStoreMigrator.copy(source, target, List.of("k"));

        assertEquals(List.of("k"), report.mismatched());
        assertFalse(report.ok());
    }
}
