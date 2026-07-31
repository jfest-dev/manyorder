package com.manyorder.api.domain.upload;

/** The hosted URL of a freshly uploaded logo. */
public class LogoUploadResponse {

    private final String url;

    public LogoUploadResponse(String url) {
        this.url = url;
    }

    public String getUrl() {
        return url;
    }
}
