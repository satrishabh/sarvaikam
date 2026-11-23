package com.sarvaikam.core.identity;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;

/**
 * A module declares which of its routes need a signed-in account or a permission. The identity module adds every
 * bean of this type to the one security filter chain, so modules never configure Spring Security themselves.
 * Routes no module declares are denied.
 */
public interface AccessRules {
    void configure(AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry rules);
}
