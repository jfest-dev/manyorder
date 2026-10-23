package com.manyorder.api.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * A single {@link Clock} bean so time-dependent services (for example the sign-in
 * lockout) read "now" from an injected clock, which tests can replace with a
 * controllable one.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
