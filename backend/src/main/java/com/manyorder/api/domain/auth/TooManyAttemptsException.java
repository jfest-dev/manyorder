package com.manyorder.api.domain.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Sign-in throttling response: HTTP 429 carrying a Retry-After header (seconds).
 * Thrown for an email that has crossed its failure threshold or an account under a
 * database lock, so an existing and an unknown email get an identical response.
 */
public class TooManyAttemptsException extends ResponseStatusException {

    private final long retryAfterSeconds;

    public TooManyAttemptsException(String reason, long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, reason);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    @Override
    public HttpHeaders getHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        return headers;
    }
}
