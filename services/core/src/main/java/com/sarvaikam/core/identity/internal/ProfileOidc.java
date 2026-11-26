package com.sarvaikam.core.identity.internal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.Map;

/**
 * The Keycloak ("Profile Manager") client that signs learners in on Keycloak's own login page.
 *
 * <p>Sign-in is enabled when PROFILE_WEB_CLIENT_SECRET is set. The client must be confidential, with the standard
 * flow, PKCE (S256) and the redirect URI {@code https://<host>/api/session/callback/profile}.
 */
@Component
class ProfileOidc {
    static final String REGISTRATION = "profile";
    private static final Logger log = LoggerFactory.getLogger(ProfileOidc.class);

    private final String issuer;
    private final String clientId;
    private final String clientSecret;
    private final String adminClientId;
    private final String adminClientSecret;
    private final ClientRegistrationRepository registrations;
    private final OAuth2AuthorizedClientRepository authorizedClients = new HttpSessionOAuth2AuthorizedClientRepository();
    private final OAuth2AuthorizedClientManager manager;
    private final RestClient http;

    ProfileOidc(@Value("${PROFILE_ISSUER:https://profile.sarvaikam.com/realms/sarvaikam}") String issuer,
                @Value("${PROFILE_WEB_CLIENT_ID:sarvaikam-learn-web}") String clientId,
                @Value("${PROFILE_WEB_CLIENT_SECRET:}") String clientSecret,
                @Value("${PROFILE_REGISTRATION_CLIENT_ID:sarvaikam-learn-registration}") String adminClientId,
                @Value("${PROFILE_REGISTRATION_CLIENT_SECRET:}") String adminClientSecret) {
        this.issuer = issuer.replaceAll("/+$", "");
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.adminClientId = adminClientId;
        this.adminClientSecret = adminClientSecret;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.http = RestClient.builder().requestFactory(factory).build();
        if (enabled()) {
            this.registrations = new InMemoryClientRegistrationRepository(registration());
            var provider = OAuth2AuthorizedClientProviderBuilder.builder().authorizationCode().refreshToken().build();
            var clientManager = new DefaultOAuth2AuthorizedClientManager(registrations, authorizedClients);
            clientManager.setAuthorizedClientProvider(provider);
            this.manager = clientManager;
        } else {
            this.registrations = null;
            this.manager = null;
        }
    }

    boolean enabled() { return clientSecret != null && !clientSecret.isBlank(); }

    ClientRegistrationRepository registrations() { return registrations; }

    OAuth2AuthorizedClientRepository authorizedClients() { return authorizedClients; }

    OAuth2AuthorizedClientManager manager() { return manager; }

    /** Built from Keycloak's fixed endpoint layout, so startup does not depend on Keycloak being reachable. */
    private ClientRegistration registration() {
        String oidc = issuer + "/protocol/openid-connect";
        return ClientRegistration.withRegistrationId(REGISTRATION)
                .clientId(clientId)
                .clientSecret(clientSecret)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/api/session/callback/{registrationId}")
                .scope("openid", "email", "profile")
                .authorizationUri(oidc + "/auth")
                .tokenUri(oidc + "/token")
                .jwkSetUri(oidc + "/certs")
                .issuerUri(issuer)
                .userNameAttributeName("sub")
                .providerConfigurationMetadata(Map.of("end_session_endpoint", oidc + "/logout"))
                .clientName("Sarvaikam Learn")
                .build();
    }

    /**
     * Ends the Keycloak session behind this refresh token. Returns false when Keycloak could not be reached; the
     * local session ends regardless, and the Keycloak session then expires on its own idle timeout.
     */
    boolean revoke(String refreshToken) {
        if (refreshToken == null) return true;
        var form = new LinkedMultiValueMap<String, String>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken);
        try {
            int status = http.post().uri(issuer + "/protocol/openid-connect/logout")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                    .exchange((req, res) -> res.getStatusCode().value());
            // 400 means the token was already invalid: the session is over either way.
            return status < 300 || status == 400;
        } catch (RestClientException e) {
            log.warn("Keycloak sign-out failed: {}", e.getMessage());
            return false;
        }
    }

    /** Ends every Keycloak session of this identity. Needs manage-users on the registration client. */
    void logoutEverywhere(String subject) throws ProfileUnavailable {
        if (adminClientSecret == null || adminClientSecret.isBlank())
            throw new ProfileUnavailable("PROFILE_REGISTRATION_CLIENT_SECRET is not set");
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "client_credentials");
            form.add("client_id", adminClientId);
            form.add("client_secret", adminClientSecret);
            Map<?, ?> token = http.post().uri(issuer + "/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form)
                    .retrieve().body(Map.class);
            if (token == null || !(token.get("access_token") instanceof String access))
                throw new ProfileUnavailable("no admin token");
            String[] realm = issuer.split("/realms/", 2);
            http.post().uri(realm[0] + "/admin/realms/{realm}/users/{id}/logout", realm[1], subject)
                    .header("Authorization", "Bearer " + access).retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            throw new ProfileUnavailable(e.getMessage());
        }
    }

    static final class ProfileUnavailable extends Exception {
        ProfileUnavailable(String message) { super(message); }
    }
}
