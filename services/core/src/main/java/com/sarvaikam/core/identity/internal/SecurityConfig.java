package com.sarvaikam.core.identity.internal;

import com.sarvaikam.core.identity.AccessRules;
import com.sarvaikam.core.platform.ApiErrors;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.List;

@Configuration
class SecurityConfig {

    /**
     * The browser session: Keycloak sign-in and the session endpoints. The only chain that creates sessions.
     * Spring Security's own CSRF tokens are off because every call that reads or changes the session requires the
     * X-Sarvaikam-Client header (see {@link SessionController}), and the cookie is SameSite=Lax.
     */
    @Bean
    @Order(1)
    SecurityFilterChain sessionChain(HttpSecurity http, ProfileOidc oidc) throws Exception {
        http.securityMatcher("/api/session/**")
            .csrf(c -> c.disable())
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .logout(l -> l.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(rules -> rules.anyRequest().permitAll())
            .exceptionHandling(e -> e.authenticationEntryPoint((req, res, ex) -> ApiErrors.write(res, 401, "signed out")));
        if (oidc.enabled()) {
            http.oauth2Login(login -> login
                .clientRegistrationRepository(oidc.registrations())
                .authorizedClientRepository(oidc.authorizedClients())
                .authorizationEndpoint(a -> a.authorizationRequestResolver(new ProfileAuthorizationRequests(oidc.registrations())))
                .redirectionEndpoint(r -> r.baseUri("/api/session/callback/*"))
                .successHandler((req, res, auth) -> {
                    HttpSession session = req.getSession(false);
                    Object target = session == null ? null : session.getAttribute(SessionController.RETURN_TO);
                    if (session != null) session.removeAttribute(SessionController.RETURN_TO);
                    res.sendRedirect(SessionController.safeReturnTo(target instanceof String s ? s : null));
                })
                // The login page reads ?signin=failed and explains; Keycloak's own message is not shown to users.
                .failureHandler((req, res, ex) -> res.sendRedirect("/login?signin=failed")));
        }
        return http.build();
    }

    /** The API: stateless, authenticated by the app token the session hands out. */
    @Bean
    @Order(2)
    SecurityFilterChain apiChain(HttpSecurity http, List<AccessRules> modules, AccountDirectory accounts,
                                 @Value("${app.jwt-secret:}") String secret,
                                 @Value("${APP_ENV:prod}") String appEnv) throws Exception {
        // Bearer-only, so there is no ambient credential for CSRF to abuse.
        http.csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .logout(l -> l.disable())
            .authorizeHttpRequests(rules -> {
                // /error renders the status of a request that was already authorized.
                rules.requestMatchers("/api/core/health", "/api/core/ready", "/error").permitAll();
                modules.forEach(module -> module.configure(rules));
                rules.anyRequest().denyAll();
            })
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> ApiErrors.write(res, 401, "missing bearer token"))
                .accessDeniedHandler((req, res, ex) -> ApiErrors.write(res, 403, "access denied")))
            .addFilterBefore(new AppTokenFilter(secret, appEnv, accounts), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
