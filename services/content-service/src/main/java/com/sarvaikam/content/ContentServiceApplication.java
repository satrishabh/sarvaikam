package com.sarvaikam.content;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ContentServiceApplication {
    public static void main(String[] args) {
        var app = new SpringApplication(ContentServiceApplication.class);
        String copySource = System.getenv("STORAGE_COPY_SOURCE");
        // The one-shot storage copy job must not take the service port or pass readiness checks.
        if (copySource != null && !copySource.isBlank()) app.setDefaultProperties(java.util.Map.of("server.port", "0"));
        app.run(args);
    }
}
