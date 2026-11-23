package com.sarvaikam.core.identity.internal;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * Builds the redirect to Keycloak: authorization code with PKCE (S256), plus state and nonce. With
 * {@code ?screen=register} it opens Keycloak's sign-up page instead of the login page; both finish the same way.
 */
class ProfileAuthorizationRequests implements OAuth2AuthorizationRequestResolver {
    static final String BASE_URI = "/api/session/authorize";
    private final DefaultOAuth2AuthorizationRequestResolver base;

    ProfileAuthorizationRequests(ClientRegistrationRepository registrations) {
        base = new DefaultOAuth2AuthorizationRequestResolver(registrations, BASE_URI);
        base.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest req) {
        return forScreen(req, base.resolve(req));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest req, String registrationId) {
        return forScreen(req, base.resolve(req, registrationId));
    }

    private static OAuth2AuthorizationRequest forScreen(HttpServletRequest req, OAuth2AuthorizationRequest request) {
        if (request == null || !"register".equals(req.getParameter("screen"))) return request;
        String registrations = "/protocol/openid-connect/registrations";
        return OAuth2AuthorizationRequest.from(request)
                .authorizationUri(request.getAuthorizationUri().replace("/protocol/openid-connect/auth", registrations))
                .authorizationRequestUri(request.getAuthorizationRequestUri().replace("/protocol/openid-connect/auth", registrations))
                .build();
    }
}
