package com.sarvaikam.core.identity.internal;

import com.sarvaikam.core.platform.ApiErrors;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.ClientAuthorizationRequiredException;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The browser's session with Sarvaikam (backend-for-frontend). The browser holds one HttpOnly cookie; the
 * Keycloak tokens stay in the server-side session and never reach JavaScript.
 *
 * <ul>
 *   <li>{@code GET /api/session/login} and {@code /register} send the browser to Keycloak's login or sign-up page.</li>
 *   <li>{@code GET /api/session} returns the user and a 5-minute app token for the services the Core has not absorbed
 *       yet. Keycloak tokens are refreshed here, server-side.</li>
 *   <li>{@code POST /api/session/logout} and {@code /logout-all} end this session or every session of the account.</li>
 * </ul>
 * Calls that read or change the session must send {@code X-Sarvaikam-Client: web}. A cross-site page cannot add
 * that header without a CORS preflight, which this API never grants.
 */
@RestController
@RequestMapping("/api/session")
class SessionController {
    static final String RETURN_TO = "sarvaikam.returnTo";
    static final String CLIENT_HEADER = "X-Sarvaikam-Client";
    private static final Pattern SAFE_PATH = Pattern.compile("^/(?![/\\\\])[^\\s\\\\]{0,511}$");
    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    private final ProfileOidc oidc;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final RestClient auth;

    SessionController(ProfileOidc oidc, FindByIndexNameSessionRepository<? extends Session> sessions,
                      @Value("${AUTH_SERVICE_URL:http://localhost:8082}") String authUrl) {
        this.oidc = oidc;
        this.sessions = sessions;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(2));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.auth = RestClient.builder().baseUrl(authUrl).requestFactory(factory).build();
    }

    /** Which sign-in the web app should offer. "password" means the in-app form served by auth-service. */
    @GetMapping("/options")
    Map<String, String> options() {
        return Map.of("signIn", oidc.enabled() ? "keycloak" : "password");
    }

    @GetMapping("/login")
    ResponseEntity<?> login(@RequestParam(required = false) String returnTo, HttpServletRequest req) {
        return startSignIn(returnTo, req, "");
    }

    @GetMapping("/register")
    ResponseEntity<?> register(@RequestParam(required = false) String returnTo, HttpServletRequest req) {
        return startSignIn(returnTo, req, "?screen=register");
    }

    private ResponseEntity<?> startSignIn(String returnTo, HttpServletRequest req, String query) {
        if (!oidc.enabled()) return ApiErrors.body(404, "Keycloak sign-in is not configured");
        req.getSession(true).setAttribute(RETURN_TO, safeReturnTo(returnTo));
        return ResponseEntity.status(302)
                .location(URI.create("/api/session/authorize/" + ProfileOidc.REGISTRATION + query)).build();
    }

    /** Only same-site paths, so the sign-in link cannot be used to bounce people to another site. */
    static String safeReturnTo(String value) {
        return value != null && SAFE_PATH.matcher(value).matches() ? value : "/";
    }

    @GetMapping
    ResponseEntity<?> current(HttpServletRequest req, HttpServletResponse res) {
        if (!fromWebApp(req)) return ApiErrors.body(403, "missing client header");
        if (!(signedIn() instanceof OAuth2AuthenticationToken token) || !oidc.enabled())
            return ApiErrors.body(401, "signed out");

        OAuth2AuthorizedClient client;
        try {
            // Refreshes the Keycloak access token when it has expired.
            client = oidc.manager().authorize(OAuth2AuthorizeRequest.withClientRegistrationId(ProfileOidc.REGISTRATION)
                    .principal(token)
                    .attribute(HttpServletRequest.class.getName(), req)
                    .attribute(HttpServletResponse.class.getName(), res)
                    .build());
        } catch (ClientAuthorizationRequiredException e) {
            client = null;
        } catch (OAuth2AuthorizationException e) {
            if (OAuth2ErrorCodes.INVALID_GRANT.equals(e.getError().getErrorCode())) {
                end(req);
                return ApiErrors.body(401, "Your session ended. Sign in again to continue.");
            }
            // Keycloak is unreachable or failing: keep the session and let the browser retry.
            log.warn("Keycloak token refresh failed: {}", e.getMessage());
            return unavailable();
        }
        if (client == null) {
            end(req);
            return ApiErrors.body(401, "Your session ended. Sign in again to continue.");
        }

        try {
            return auth.post().uri("/api/auth/oidc/exchange")
                    .header("Authorization", "Bearer " + client.getAccessToken().getTokenValue())
                    .exchange((rq, rs) -> {
                        int status = rs.getStatusCode().value();
                        String body = new String(rs.getBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                        if (status == 200)
                            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
                        if (status == 401 || status == 403 || status == 409) {
                            // Suspended, unverified or conflicting account: auth-service's message explains which.
                            end(req);
                            return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
                        }
                        log.warn("auth-service exchange answered {}", status);
                        return unavailable();
                    });
        } catch (RestClientException e) {
            log.warn("auth-service exchange failed: {}", e.getMessage());
            return unavailable();
        }
    }

    /** Always completes: the session here ends even if Keycloak cannot be told. */
    @PostMapping("/logout")
    ResponseEntity<?> logout(HttpServletRequest req) {
        if (!fromWebApp(req)) return ApiErrors.body(403, "missing client header");
        boolean revoked = true;
        if (signedIn() instanceof OAuth2AuthenticationToken token && oidc.enabled()) {
            OAuth2AuthorizedClient client = oidc.authorizedClients()
                    .loadAuthorizedClient(ProfileOidc.REGISTRATION, token, req);
            if (client != null && client.getRefreshToken() != null)
                revoked = oidc.revoke(client.getRefreshToken().getTokenValue());
        }
        end(req);
        return ResponseEntity.ok(Map.of("message", "Signed out", "revoked", revoked));
    }

    /** Ends every Keycloak session of the account and every Core session it has, on all devices. */
    @PostMapping("/logout-all")
    ResponseEntity<?> logoutEverywhere(HttpServletRequest req) {
        if (!fromWebApp(req)) return ApiErrors.body(403, "missing client header");
        if (!(signedIn() instanceof OAuth2AuthenticationToken token) || !oidc.enabled())
            return ApiErrors.body(401, "signed out");
        String subject = token.getName();
        try {
            oidc.logoutEverywhere(subject);
        } catch (ProfileOidc.ProfileUnavailable e) {
            log.warn("sign out everywhere failed: {}", e.getMessage());
            return ApiErrors.body(503, "Other devices could not be signed out. Try again shortly.");
        }
        sessions.findByPrincipalName(subject).keySet().forEach(sessions::deleteById);
        end(req);
        return ResponseEntity.ok(Map.of("message", "Signed out on every device"));
    }

    private static Authentication signedIn() {
        return SecurityContextHolder.getContext().getAuthentication();
    }

    private static boolean fromWebApp(HttpServletRequest req) {
        return "web".equals(req.getHeader(CLIENT_HEADER));
    }

    private static void end(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) {
            try {
                session.invalidate();
            } catch (IllegalStateException alreadyInvalid) {
                // Deleted by a concurrent sign-out.
            }
        }
        SecurityContextHolder.clearContext();
    }

    private static ResponseEntity<?> unavailable() {
        return ResponseEntity.status(503).header("Retry-After", "5")
                .body(Map.of("error", "Account services are briefly unavailable. Try again in a moment."));
    }
}
