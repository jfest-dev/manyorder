package com.manyorder.api.domain.emailverification;

import jakarta.validation.constraints.NotBlank;

/** The token carried in the emailed verification link. */
public class VerifyEmailRequest {

    @NotBlank
    private String token;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
