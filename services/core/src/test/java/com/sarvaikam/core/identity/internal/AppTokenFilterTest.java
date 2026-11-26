package com.sarvaikam.core.identity.internal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class AppTokenFilterTest {
    static final String PUBLISHED = "change-me-to-a-long-random-secret-of-32-bytes-min";

    @Test
    void publishedPlaceholderSecretsAreRefusedOutsideDev() {
        for (String env : new String[]{"prod", "staging", ""}) {
            assertThatThrownBy(() -> new AppTokenFilter(PUBLISHED, env, mock(AccountDirectory.class)))
                    .hasMessageContaining("placeholder");
        }
        assertThatCode(() -> new AppTokenFilter(PUBLISHED, "dev", mock(AccountDirectory.class))).doesNotThrowAnyException();
    }

    @Test
    void shortOrMissingSecretsAreRefusedEverywhere() {
        assertThatThrownBy(() -> new AppTokenFilter("short", "dev", mock(AccountDirectory.class))).hasMessageContaining("32");
        assertThatThrownBy(() -> new AppTokenFilter("", "dev", mock(AccountDirectory.class))).hasMessageContaining("32");
    }
}
