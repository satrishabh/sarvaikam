package com.sarvaikam.content.seed;

import com.sarvaikam.content.api.PathController.PathView;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Component
@Order(20)
public class PathLoader implements ApplicationRunner {
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    public PathLoader(JdbcTemplate db, ObjectMapper mapper) { this.db = db; this.mapper = mapper; }
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        try (var in = new ClassPathResource("engineering-paths.json").getInputStream()) {
            for (var path : mapper.readValue(in, PathView[].class)) {
                // Database edits remain authoritative after the initial insertion.
                int added = db.update("INSERT INTO learning_paths(slug, name, subtitle, description, icon, tone, priority) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                    path.slug(), path.name(), path.subtitle(), path.description(), path.icon(), path.tone(), path.priority());
                if (added == 0) continue;
                int position = 0;
                for (var topic : path.topics()) db.update("INSERT INTO learning_path_topics(path_slug, topic_slug, position) VALUES (?, ?, ?)", path.slug(), topic, ++position);
                position = 0;
                for (var outcome : path.outcomes()) db.update("INSERT INTO learning_path_outcomes(path_slug, position, outcome) VALUES (?, ?, ?)", path.slug(), ++position, outcome);
            }
        }
    }
}
