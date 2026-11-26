package com.sarvaikam.content.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class BreakerTest {
    private long now = 1_800_000_000_000L;

    private JwtAuthFilter.Breaker breaker() {
        var breaker = new JwtAuthFilter.Breaker(5, Duration.ofSeconds(10));
        breaker.clock = () -> now;
        return breaker;
    }

    private static void fail(JwtAuthFilter.Breaker breaker, int times) {
        for (int i = 0; i < times; i++) {
            assertTrue(breaker.allow());
            breaker.failed();
        }
    }

    @Test
    void opensAfterFiveFailuresInARowAndFailsFast() {
        var breaker = breaker();
        fail(breaker, 4);
        assertFalse(breaker.open(), "four failures are tolerated");
        fail(breaker, 1);
        assertTrue(breaker.open());
        assertFalse(breaker.allow(), "while open, auth-service is not called");
        now += 9_999;
        assertFalse(breaker.allow());
    }

    @Test
    void aSuccessResetsTheCount() {
        var breaker = breaker();
        fail(breaker, 4);
        breaker.succeeded();
        fail(breaker, 4);
        assertFalse(breaker.open(), "failures must be consecutive");
    }

    @Test
    void afterTheCooldownOneTrialDecides() {
        var breaker = breaker();
        fail(breaker, 5);
        now += 10_000;
        assertTrue(breaker.allow(), "one trial call after the cooldown");
        assertFalse(breaker.allow(), "only one while the trial is out");
        breaker.failed();
        assertFalse(breaker.allow(), "a failed trial re-opens for another cooldown");

        now += 10_000;
        assertTrue(breaker.allow());
        breaker.succeeded();
        assertFalse(breaker.open());
        assertTrue(breaker.allow(), "closed again: every call goes through");
        assertTrue(breaker.allow());
    }

    @Test
    void aTrialThatNeverReportsBackDoesNotWedgeIt() {
        var breaker = breaker();
        fail(breaker, 5);
        now += 10_000;
        assertTrue(breaker.allow()); // the trial's caller dies without calling succeeded() or failed()
        now += 10_000;
        assertTrue(breaker.allow(), "another trial after a further cooldown");
    }
}
