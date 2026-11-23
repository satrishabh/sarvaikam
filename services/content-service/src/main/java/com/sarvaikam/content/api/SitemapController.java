package com.sarvaikam.content.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * sitemap.xml for search engines (nginx serves it at /sitemap.xml). Lists the public pages, every topic with
 * lessons, and every lesson that is not exclusive, with the lesson's last edit as lastmod.
 */
@RestController
public class SitemapController {
    static final List<String> PUBLIC_PAGES = List.of("/", "/paths", "/interview-prep", "/practice", "/skills", "/reels");

    public record Url(String path, OffsetDateTime lastModified) {}

    private final JdbcTemplate db;
    private final String baseUrl;

    public SitemapController(JdbcTemplate db, @Value("${PUBLIC_BASE_URL:https://learn.sarvaikam.com}") String baseUrl) {
        this.db = db;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(render(baseUrl, urls()));
    }

    public List<Url> urls() {
        var urls = new ArrayList<Url>();
        PUBLIC_PAGES.forEach(p -> urls.add(new Url(p, null)));
        urls.addAll(db.query("""
                SELECT t.slug, max(l.updated_at) AS lastmod FROM topics t JOIN lessons l ON l.topic_id = t.id
                WHERE NOT l.exclusive GROUP BY t.slug ORDER BY t.slug
                """, (rs, i) -> new Url("/topics/" + rs.getString("slug"), rs.getObject("lastmod", OffsetDateTime.class))));
        urls.addAll(db.query("""
                SELECT t.slug AS topic, l.slug AS lesson, l.updated_at FROM lessons l JOIN topics t ON t.id = l.topic_id
                WHERE NOT l.exclusive ORDER BY t.slug, l.step_number, l.id
                """, (rs, i) -> new Url("/topics/" + rs.getString("topic") + "/" + rs.getString("lesson"),
                rs.getObject("updated_at", OffsetDateTime.class))));
        return urls;
    }

    public static String render(String baseUrl, List<Url> urls) {
        var xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (Url url : urls) {
            xml.append("  <url><loc>").append(escape(baseUrl + url.path())).append("</loc>");
            if (url.lastModified() != null)
                xml.append("<lastmod>").append(url.lastModified().format(DateTimeFormatter.ISO_LOCAL_DATE)).append("</lastmod>");
            xml.append("</url>\n");
        }
        return xml.append("</urlset>\n").toString();
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }
}
