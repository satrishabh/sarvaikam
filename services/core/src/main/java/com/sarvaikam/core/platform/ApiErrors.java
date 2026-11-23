package com.sarvaikam.core.platform;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

/** Every error body is {@code {"error": "..."}}, the shape the services being replaced already return. */
@RestControllerAdvice
public class ApiErrors {

    public static ResponseEntity<Map<String, String>> body(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    /** For filters, which run before Spring MVC and cannot return a ResponseEntity. Messages are fixed strings. */
    public static void write(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + message.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> status(ResponseStatusException e) {
        return body(e.getStatusCode().value(), e.getReason() == null ? "request failed" : e.getReason());
    }
}
