package com.sarvaikam.core.learning.internal;

import com.sarvaikam.core.identity.AccessRules;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.stereotype.Component;

@Component
class LearningAccessRules implements AccessRules {
    @Override
    public void configure(AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry rules) {
        rules.requestMatchers("/api/progress/health", "/api/progress/ready").permitAll()
             .requestMatchers("/api/progress/**").authenticated();
    }
}
