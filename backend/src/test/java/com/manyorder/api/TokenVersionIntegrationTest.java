package com.manyorder.api;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.passwordreset.PasswordResetMailer;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Token versioning: a bump (sign out everywhere, or a password reset) rejects
 * every previously issued token while a freshly returned token keeps working, and
 * a legacy token with no version claim still verifies (version 0).
 */
class TokenVersionIntegrationTest extends IntegrationTestBase {

    @MockitoSpyBean private PasswordResetMailer mailer;
    @Value("${app.jwt.secret}") private String jwtSecret;

    @Test
    void signOutEverywhere_rejectsOldToken_keepsNewToken() throws Exception {
        String oldToken = registerAndGetToken("tv-soe@test.com", "MERCHANT", null);

        MvcResult result = mockMvc.perform(post("/account/sign-out-everywhere")
                        .header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk())
                .andReturn();
        String newToken = json(result).get("token").asText();

        assertNotEquals(oldToken, newToken, "a fresh token is issued for this device");
        getWithToken("/merchant/stores", newToken, 200);
        getWithToken("/merchant/stores", oldToken, 401);
    }

    @Test
    void passwordReset_bumpsVersion_andRejectsOldToken() throws Exception {
        String email = "tv-reset@test.com";
        String oldToken = registerAndGetToken(email, "MERCHANT", null);

        // Drive the real forgot/reset flow, recovering the raw token from the email.
        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk());
        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendResetLink(eq(email), urlCaptor.capture());
        String rawToken = urlCaptor.getValue().substring(urlCaptor.getValue().indexOf("token=") + "token=".length());

        Map<String, Object> body = new HashMap<>();
        body.put("token", rawToken);
        body.put("newPassword", "brandnew1");
        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isNoContent());

        // The token issued before the reset no longer authorizes.
        getWithToken("/merchant/stores", oldToken, 401);
    }

    @Test
    void legacyTokenWithoutVersionClaim_stillWorks() throws Exception {
        String email = "tv-legacy@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        // A token minted the old way: no "ver" claim at all, signed with the same key.
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        String legacy = Jwts.builder().subject(email).claim("role", "MERCHANT")
                .issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + 86_400_000L))
                .signWith(key).compact();

        getWithToken("/merchant/stores", legacy, 200);
    }
}
