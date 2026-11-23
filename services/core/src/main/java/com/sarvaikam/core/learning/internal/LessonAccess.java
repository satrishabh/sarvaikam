package com.sarvaikam.core.learning.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * Asks content-service whether the caller may use a lesson in a topic. This becomes an in-process call to the
 * catalog module when content moves into the Core.
 */
@Component
class LessonAccess {
    private final RestClient http;

    LessonAccess(@Value("${CONTENT_SERVICE_URL:http://localhost:8081}") String contentUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.http = RestClient.builder().baseUrl(contentUrl).requestFactory(factory).build();
    }

    /**
     * Returns 200 when allowed. 400, 401, 403 and 404 are content-service's decision, passed to the caller; any
     * other answer, or no answer, is 503.
     */
    int check(long lessonId, String topicSlug, String authorization) {
        try {
            Integer status = http.get()
                    .uri("/api/content/lessons/{id}/access?topicSlug={slug}", lessonId, topicSlug)
                    .header("Authorization", authorization)
                    .exchange((req, res) -> res.getStatusCode().value());
            if (status == null) return 503;
            return switch (status) {
                case 200, 400, 401, 403, 404 -> status;
                default -> 503;
            };
        } catch (RestClientException e) {
            return 503;
        }
    }
}
