package com.sarvaikam.core.identity.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;

/**
 * Reads the caller's account from auth-service on every request, so a suspension or a permission change applies
 * to sessions that already exist. The JWT's own role claim is never trusted for authorization.
 */
@Component
class AccountDirectory {
    record Account(String id, List<String> permissions) {}

    /** auth-service could not be reached or failed; the caller should retry rather than be signed out. */
    static final class Unavailable extends Exception {
        Unavailable(String message, Throwable cause) { super(message, cause); }
    }

    // Compared by reference, so they cannot collide with a real response.
    private static final Account REJECTED = new Account(null, null);
    private static final Account FAILED = new Account(null, null);

    private final RestClient http;

    AccountDirectory(@Value("${AUTH_SERVICE_URL:http://localhost:8082}") String authUrl) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(3));
        this.http = RestClient.builder().baseUrl(authUrl).requestFactory(factory).build();
    }

    /** The account behind this bearer credential, or null when auth-service rejects it. */
    Account current(String authorization) throws Unavailable {
        Account result;
        try {
            result = http.get().uri("/api/auth/me").header("Authorization", authorization).exchange((req, res) -> {
                int status = res.getStatusCode().value();
                if (status >= 500) return FAILED;
                if (status != 200) return REJECTED;
                try {
                    Account account = res.bodyTo(Account.class);
                    return account == null || account.id() == null || account.permissions() == null ? REJECTED : account;
                } catch (RuntimeException malformed) {
                    return REJECTED;
                }
            });
        } catch (RestClientException e) {
            throw new Unavailable("account service unreachable", e);
        }
        if (result == FAILED) throw new Unavailable("account service failed", null);
        return result == REJECTED ? null : result;
    }
}
