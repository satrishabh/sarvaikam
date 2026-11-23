package com.sarvaikam.content.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.LoggerFactory;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.logging.LoggingInitializationContext;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

/** LOG_FORMAT=json must produce one JSON object per line with the "severity" field Cloud Logging reads. */
@ExtendWith(OutputCaptureExtension.class)
class StructuredLoggingTest {
    @Test
    void jsonLogsCarryCloudLoggingSeverity(CapturedOutput output) throws Exception {
        var env = new MockEnvironment();
        new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))
                .forEach(env.getPropertySources()::addLast);
        env.setProperty("logging.structured.format.console", "logstash"); // what the entrypoint sets
        var logging = LoggingSystem.get(getClass().getClassLoader());
        logging.beforeInitialize();
        logging.initialize(new LoggingInitializationContext(env), null, null);
        try {
            LoggerFactory.getLogger("com.sarvaikam.check").warn("structured logging check");
            String line = output.getOut().lines().filter(l -> l.contains("structured logging check")).findFirst().orElseThrow();
            assertThat(line).startsWith("{").contains("\"severity\":\"WARN\"").doesNotContain("\"level\":");
        } finally {
            logging.cleanUp();
            logging.beforeInitialize();
            logging.initialize(new LoggingInitializationContext(new MockEnvironment()), null, null);
        }
    }
}
