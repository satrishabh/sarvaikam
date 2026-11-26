package com.sarvaikam.content.service;

import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Exercises the copy job with a mocked database and in-memory stores (no cloud or database needed). */
class ContentStorageCopyRunnerTest {

    /** A source named "source" that serves the given in-memory store. */
    private static ObjectStoreProvider sourceProvider(ObjectStore store) {
        return new ObjectStoreProvider() {
            public String name() { return "source"; }
            public ObjectStore create() { return store; }
        };
    }

    private static JdbcTemplate db(List<String> lessons, List<String> practice, List<String> assets) throws Exception {
        JdbcTemplate db = mock(JdbcTemplate.class);
        when(db.queryForList(eq("SELECT content_object FROM lessons WHERE content_object IS NOT NULL"), eq(String.class))).thenReturn(lessons);
        when(db.queryForList(eq("SELECT content_object FROM content_documents WHERE content_object IS NOT NULL"), eq(String.class))).thenReturn(practice);
        when(db.queryForList(eq("SELECT object_name FROM lesson_assets WHERE ready = true"), eq(String.class))).thenReturn(assets);
        return db;
    }

    @Test
    void copiesEveryReferencedObjectUnderItsOriginalKey() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        source.create("lesson-bodies/a.md", "lesson".getBytes(), "text/markdown");
        source.create("practice-bodies/p.json", "practice".getBytes(), "application/json");
        source.create("attachments/x.pdf", "pdf".getBytes(), "application/pdf");
        var target = new ObjectStoreAdapterTest.MemoryStore();
        var runner = new ContentStorageCopyRunner(db(List.of("lesson-bodies/a.md"), List.of("practice-bodies/p.json"),
                List.of("attachments/x.pdf")), target, List.of(sourceProvider(source)),
                mock(ApplicationContext.class), "source", null);

        var report = runner.execute();

        assertTrue(report.ok());
        assertEquals(3, report.copied());
        assertArrayEquals("pdf".getBytes(), target.read("attachments/x.pdf"));
    }

    @Test
    void duplicateAndBlankKeysAreCopiedOnce() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        source.create("shared.md", "x".getBytes(), "text/plain");
        var target = new ObjectStoreAdapterTest.MemoryStore();
        var runner = new ContentStorageCopyRunner(db(List.of("shared.md", ""), List.of("shared.md"), List.of()),
                target, List.of(sourceProvider(source)), mock(ApplicationContext.class), "source", null);

        var report = runner.execute();

        assertEquals(1, report.copied());
        assertEquals(0, report.missing().size());
    }

    @Test
    void missingSourceObjectsFailTheRun() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        var target = new ObjectStoreAdapterTest.MemoryStore();
        var runner = new ContentStorageCopyRunner(db(List.of("gone.md"), List.of(), List.of()),
                target, List.of(sourceProvider(source)), mock(ApplicationContext.class), "source", null);

        var report = runner.execute();

        assertFalse(report.ok());
        assertEquals(List.of("gone.md"), report.missing());
    }

    @Test
    void reelBodiesAreReadFromTheSeparateReelsDatabase() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        source.create("lesson-bodies/a.md", "lesson".getBytes(), "text/markdown");
        source.create("reel-bodies/r.md", "reel".getBytes(), "text/markdown");
        var target = new ObjectStoreAdapterTest.MemoryStore();
        var reels = mock(ReelService.class);
        when(reels.contentObjects()).thenReturn(List.of("reel-bodies/r.md"));
        var runner = new ContentStorageCopyRunner(db(List.of("lesson-bodies/a.md"), List.of(), List.of()),
                target, List.of(sourceProvider(source)), mock(ApplicationContext.class), "source", reels);

        var report = runner.execute();

        assertTrue(report.ok());
        assertEquals(2, report.copied());
        assertArrayEquals("reel".getBytes(), target.read("reel-bodies/r.md"));
    }

    @Test
    void oneFailingObjectIsReportedAndTheRestStillCopy() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        source.create("ok.md", "ok".getBytes(), "text/plain");
        source.create("bad.md", "bad".getBytes(), "text/plain");
        var target = new ObjectStoreAdapterTest.MemoryStore() {
            @Override public void create(String key, byte[] data, String contentType) {
                if (key.equals("bad.md")) throw new RuntimeException("network");
                super.create(key, data, contentType);
            }
        };
        var report = ObjectStoreMigrator.copy(source, target, List.of("bad.md", "ok.md"));

        assertFalse(report.ok());
        assertEquals(1, report.copied());
        assertEquals(1, report.failed().size());
        assertTrue(report.failed().get(0).startsWith("bad.md"));
    }

    @Test
    void aConcurrentRunThatWroteTheKeyFirstCountsAsSkipped() throws Exception {
        var source = new ObjectStoreAdapterTest.MemoryStore();
        source.create("k.md", "abc".getBytes(), "text/plain");
        var target = new ObjectStoreAdapterTest.MemoryStore() {
            boolean firstStat = true;
            @Override public Stat stat(String key) {
                if (firstStat) { firstStat = false; return null; }   // looked absent, then the other run won
                return super.stat(key);
            }
        };
        target.create("k.md", "abc".getBytes(), "text/plain");

        var report = ObjectStoreMigrator.copy(source, target, List.of("k.md"));

        assertTrue(report.ok());
        assertEquals(1, report.skipped());
    }

    @Test
    void doesNothingWhenNoSourceIsConfigured() throws Exception {
        var target = new ObjectStoreAdapterTest.MemoryStore();
        JdbcTemplate db = mock(JdbcTemplate.class);
        var context = mock(ApplicationContext.class);
        new ContentStorageCopyRunner(db, target, List.of(), context, "", null).run(null);
        verifyNoInteractions(db, context);
    }
}
