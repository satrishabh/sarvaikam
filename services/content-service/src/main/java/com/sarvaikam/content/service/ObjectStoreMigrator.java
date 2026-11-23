package com.sarvaikam.content.service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Copies stored objects from one adapter to another, keeping their keys so database references stay valid.
 * Works between any two {@link ObjectStore} implementations, so it is reused for every cloud move.
 *
 * <ul>
 *   <li>Re-running is safe: objects already present with the same size are skipped; size mismatches are reported.</li>
 *   <li>Objects are streamed, so multi-gigabyte assets never have to fit in memory.</li>
 *   <li>One failing object is reported and the run continues with the rest.</li>
 *   <li>A concurrent run that wrote the same key first counts as skipped, whatever error the adapter raised.</li>
 * </ul>
 */
public final class ObjectStoreMigrator {

    public record Report(int copied, int skipped, List<String> missing, List<String> mismatched, List<String> failed) {
        public Report(int copied, int skipped, List<String> missing, List<String> mismatched) {
            this(copied, skipped, missing, mismatched, List.of());
        }
        public boolean ok() { return missing.isEmpty() && mismatched.isEmpty() && failed.isEmpty(); }
    }

    private enum Outcome { COPIED, SKIPPED, MISSING, MISMATCHED }

    private ObjectStoreMigrator() {}

    public static Report copy(ObjectStore from, ObjectStore to, Iterable<String> keys) {
        int copied = 0, skipped = 0;
        List<String> missing = new ArrayList<>(), mismatched = new ArrayList<>(), failed = new ArrayList<>();
        for (String key : keys) {
            try {
                switch (copyOne(from, to, key)) {
                    case COPIED -> copied++;
                    case SKIPPED -> skipped++;
                    case MISSING -> missing.add(key);
                    case MISMATCHED -> mismatched.add(key);
                }
            } catch (Exception e) {
                failed.add(key + " (" + e.getClass().getSimpleName() + ": " + e.getMessage() + ")");
            }
        }
        return new Report(copied, skipped, missing, mismatched, failed);
    }

    private static Outcome copyOne(ObjectStore from, ObjectStore to, String key) throws Exception {
        ObjectStore.Stat source = from.stat(key);
        if (source == null) return Outcome.MISSING;
        ObjectStore.Stat existing = to.stat(key);
        if (existing != null) return existing.size() == source.size() ? Outcome.SKIPPED : Outcome.MISMATCHED;
        try (InputStream in = from.open(key, source.version())) {
            to.createFrom(key, in, source.size(), source.contentType());
        } catch (Exception e) {
            // Another run may have written it first; adapters report that differently, so trust a fresh stat.
            ObjectStore.Stat raced = to.stat(key);
            if (raced != null && raced.size() == source.size()) return Outcome.SKIPPED;
            throw e;
        }
        ObjectStore.Stat written = to.stat(key);
        return written != null && written.size() == source.size() ? Outcome.COPIED : Outcome.MISMATCHED;
    }
}
