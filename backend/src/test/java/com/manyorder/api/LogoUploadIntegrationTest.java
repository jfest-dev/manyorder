package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Server-side gate for the logo upload endpoint. The image host is unconfigured
 * in tests (no CLOUDINARY_* env), so every rejection here is proven to happen
 * before any upload is attempted, and a valid file surfaces the 503 disabled
 * path. The successful-upload wiring is covered separately with a mocked host
 * in {@link LogoUploadWiringIntegrationTest}.
 */
class LogoUploadIntegrationTest extends IntegrationTestBase {

    private static final String URL = "/merchant/uploads/logo";

    // 89 50 4E 47 0D 0A 1A 0A — a real PNG signature.
    private static final byte[] PNG_MAGIC =
            {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    private MockMultipartFile file(byte[] bytes, String contentType) {
        return new MockMultipartFile("file", "logo.png", contentType, bytes);
    }

    @Test
    void unauthenticated_isRejected() throws Exception {
        mockMvc.perform(multipart(URL).file(file(PNG_MAGIC, "image/png")))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void staff_isForbidden() throws Exception {
        String ownerToken = registerAndGetToken("logo-up-owner@test.com", "MERCHANT", null);
        createStore(ownerToken, "Logo Up Store", "logo-up-store");
        String staffToken = registerAndGetToken("logo-up-staff@test.com", "STAFF", "logo-up-store");

        mockMvc.perform(multipart(URL).file(file(PNG_MAGIC, "image/png"))
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonImageBytes_areRejected_evenWhenContentTypeClaimsImage() throws Exception {
        String token = registerAndGetToken("logo-fake@test.com", "MERCHANT", null);

        // Declared image/png, but the bytes are plain text: magic-byte sniff fails.
        MockMultipartFile fake = file("this is not an image".getBytes(), "image/png");
        mockMvc.perform(multipart(URL).file(fake)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void oversizeFile_isRejected() throws Exception {
        String token = registerAndGetToken("logo-big@test.com", "MERCHANT", null);

        byte[] tooBig = new byte[5 * 1024 * 1024 + 1]; // just over 5 MB
        System.arraycopy(PNG_MAGIC, 0, tooBig, 0, PNG_MAGIC.length);

        mockMvc.perform(multipart(URL).file(file(tooBig, "image/png"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emptyFile_isRejected() throws Exception {
        String token = registerAndGetToken("logo-empty@test.com", "MERCHANT", null);

        mockMvc.perform(multipart(URL).file(file(new byte[0], "image/png"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validImage_butHostUnconfigured_returns503() throws Exception {
        String token = registerAndGetToken("logo-unconfigured@test.com", "MERCHANT", null);

        // Passes validation; fails only because CLOUDINARY_* is unset in tests.
        mockMvc.perform(multipart(URL).file(file(PNG_MAGIC, "image/png"))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable());
    }
}
