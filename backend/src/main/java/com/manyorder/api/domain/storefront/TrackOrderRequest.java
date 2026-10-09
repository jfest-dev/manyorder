package com.manyorder.api.domain.storefront;

import jakarta.validation.constraints.NotBlank;

/** Body for the public read-by-token endpoint. The token travels in the body (not the URL). */
public class TrackOrderRequest {

    @NotBlank
    private String token;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
