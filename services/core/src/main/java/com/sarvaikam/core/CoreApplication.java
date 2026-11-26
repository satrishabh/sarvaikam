package com.sarvaikam.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Sarvaikam Core: one deployable made of modules (the direct sub-packages). Spring Modulith verifies the module
 * boundaries in {@code ModularityTests}. The Core replaces the separate services one route at a time.
 */
@SpringBootApplication
public class CoreApplication {
    public static void main(String[] args) {
        SpringApplication.run(CoreApplication.class, args);
    }
}
