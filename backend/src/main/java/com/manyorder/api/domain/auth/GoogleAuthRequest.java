package com.manyorder.api.domain.auth;

import jakarta.validation.constraints.NotBlank;

public class GoogleAuthRequest {

    @NotBlank
    private String idToken;

    public GoogleAuthRequest() {}

    public String getIdToken() { return idToken; }
    public void setIdToken(String idToken) { this.idToken = idToken; }
}
