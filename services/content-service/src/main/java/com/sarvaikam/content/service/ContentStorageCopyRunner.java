package com.sarvaikam.content.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * One-shot job: when STORAGE_COPY_SOURCE is set (for example "gcs"), copies every object referenced by the
 * database from that adapter into the active STORAGE_BACKEND, then exits. Without the variable the application
 * runs normally and this does nothing. Object keys are kept, so database references stay valid.
 *
 * Exit code 0 means every referenced object is present in the target with the same size; 1 means something
 * is missing, mismatched or failed and must be checked before switching STORAGE_BACKEND.
 *
 * Runs before every other startup runner and exits, so seeding and body migration never write new objects
 * into the target while live pods still read the old store. ContentServiceApplication also moves the web
 * server off the service port in this mode.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ContentStorageCopyRunner implements ApplicationRunner {
    private static final List<String> KEY_QUERIES = List.of(
            "SELECT content_object FROM lessons WHERE content_object IS NOT NULL",
            "SELECT content_object FROM content_documents WHERE content_object IS NOT NULL",
            // Abandoned uploads never produced an object; counting them would fail every run.
            "SELECT object_name FROM lesson_assets WHERE ready = true");

    private final JdbcTemplate db;
    private final ObjectStore target;
    private final List<ObjectStoreProvider> providers;
    private final ApplicationContext context;
    private final String sourceName;
    private final ReelService reels;

    public ContentStorageCopyRunner(JdbcTemplate db, ObjectStore target, List<ObjectStoreProvider> providers,
                                    ApplicationContext context, @Value("${STORAGE_COPY_SOURCE:}") String sourceName,
                                    ReelService reels) {
        this.reels = reels;
        this.db = db;
        this.target = target;
        this.providers = providers;
        this.context = context;
        this.sourceName = sourceName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (sourceName == null || sourceName.isBlank()) return;
        int code = execute().ok() ? 0 : 1;
        System.out.println("storage copy finished with exit code " + code);
        System.exit(SpringApplication.exit(context, () -> code));
    }

    /** Copies the referenced objects and returns the verification report. Safe to re-run. */
    public ObjectStoreMigrator.Report execute() {
        ObjectStore source = StorageConfig.select(sourceName, providers).create();
        Set<String> keys = referencedKeys();
        ObjectStoreMigrator.Report report = ObjectStoreMigrator.copy(source, target, keys);
        System.out.printf("storage copy: %d referenced, %d copied, %d already present, %d missing, %d mismatched%n",
                keys.size(), report.copied(), report.skipped(), report.missing().size(), report.mismatched().size());
        report.missing().forEach(k -> System.out.println("missing: " + k));
        report.mismatched().forEach(k -> System.out.println("mismatched: " + k));
        report.failed().forEach(k -> System.out.println("failed: " + k));
        return report;
    }

    Set<String> referencedKeys() {
        Set<String> keys = new LinkedHashSet<>();
        for (String sql : KEY_QUERIES) keys.addAll(nonBlank(db.queryForList(sql, String.class)));
        // Reels live in their own database (REELS_DB_URL), not in the content connection.
        List<String> reelKeys = reels == null ? null : reels.contentObjects();
        if (reelKeys == null) System.out.println("reels database not configured (REELS_DB_URL): no reel bodies to copy");
        else keys.addAll(nonBlank(reelKeys));
        return keys;
    }

    private static List<String> nonBlank(List<String> values) {
        List<String> out = new ArrayList<>();
        for (String v : values) if (v != null && !v.isBlank()) out.add(v);
        return out;
    }
}
