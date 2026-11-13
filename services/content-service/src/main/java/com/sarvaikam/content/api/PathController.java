package com.sarvaikam.content.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.sarvaikam.content.security.ContentAccess;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class PathController {
    public record PathView(String slug, String name, String subtitle, String description,
                           String icon, String tone, int priority, List<String> topics, List<String> outcomes) {}
    public record PathRequest(
        @NotBlank @Size(max=100) @Pattern(regexp="[a-z0-9]+(-[a-z0-9]+)*") String slug,
        @NotBlank @Size(max=200) String name,
        @NotBlank @Size(max=1000) String subtitle,
        @NotBlank @Size(max=10000) String description,
        @NotBlank @Pattern(regexp="book|code|layers|cloud|target|chart|spark") String icon,
        @NotBlank @Pattern(regexp="teal|violet|blue") String tone,
        @Min(1) @Max(10000) int priority,
        @NotNull @Size(max=200) List<@NotBlank @Size(max=100) String> topics,
        @NotNull @Size(max=30) List<@NotBlank @Size(max=1000) String> outcomes) {}
    private final JdbcTemplate db;
    public PathController(JdbcTemplate db) { this.db = db; }
    @PutMapping("/admin/paths")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@Valid @RequestBody PathRequest request) {
        ContentAccess.require("content.manage");
        if (new java.util.HashSet<>(request.topics()).size() != request.topics().size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose each course only once");
        for (String topic : request.topics()) {
            if (!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM topics WHERE slug = ?)", Boolean.class, topic)))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Course does not exist: " + topic);
        }
        // The upsert locks this path until its ordered courses and outcomes are replaced.
        db.update("""
            INSERT INTO learning_paths(slug, name, subtitle, description, icon, tone, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET name=excluded.name, subtitle=excluded.subtitle,
              description=excluded.description, icon=excluded.icon, tone=excluded.tone, priority=excluded.priority
            """, request.slug(), request.name(), request.subtitle(), request.description(), request.icon(), request.tone(), request.priority());
        db.update("DELETE FROM learning_path_topics WHERE path_slug = ?", request.slug());
        db.update("DELETE FROM learning_path_outcomes WHERE path_slug = ?", request.slug());
        int position = 0;
        for (String topic : request.topics()) db.update("INSERT INTO learning_path_topics(path_slug, topic_slug, position) VALUES (?, ?, ?)", request.slug(), topic, ++position);
        position = 0;
        for (String outcome : request.outcomes()) db.update("INSERT INTO learning_path_outcomes(path_slug, position, outcome) VALUES (?, ?, ?)", request.slug(), ++position, outcome);
    }
    @GetMapping("/paths")
    @Transactional(readOnly=true)
    public List<PathView> paths() {
        return db.query("SELECT * FROM learning_paths ORDER BY priority, slug", (rs, n) -> {
            String slug = rs.getString("slug");
            return new PathView(slug, rs.getString("name"), rs.getString("subtitle"), rs.getString("description"),
                rs.getString("icon"), rs.getString("tone"), rs.getInt("priority"),
                db.queryForList("SELECT topic_slug FROM learning_path_topics WHERE path_slug = ? ORDER BY position", String.class, slug),
                db.queryForList("SELECT outcome FROM learning_path_outcomes WHERE path_slug = ? ORDER BY position", String.class, slug));
        });
    }
}
