package com.sarvaikam.core.platform;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
class HealthController {
    private final Readiness readiness;

    HealthController(Readiness readiness) { this.readiness = readiness; }

    @GetMapping("/api/core/health")
    Map<String, String> health() { return Map.of("status", "UP"); }

    @GetMapping("/api/core/ready")
    ResponseEntity<Readiness.Report> ready() {
        var report = readiness.check();
        return ResponseEntity.status(report.ready() ? 200 : 503).body(report);
    }
}
