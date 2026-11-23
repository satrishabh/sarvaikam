package com.sarvaikam.core;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/** Fails the build when a module reaches into another module's internals or modules depend on each other in a cycle. */
class ModularityTests {
    static final ApplicationModules modules = ApplicationModules.of(CoreApplication.class);

    @Test
    void moduleBoundariesHold() {
        modules.verify();
    }

    /** Writes the module diagram and canvases to target/spring-modulith-docs. */
    @Test
    void documentModules() {
        new Documenter(modules).writeDocumentation();
    }
}
