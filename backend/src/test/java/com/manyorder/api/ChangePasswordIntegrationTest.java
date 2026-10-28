package com.manyorder.api;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Change Password for the signed-in account — Module: Settings / Account. */
class ChangePasswordIntegrationTest extends IntegrationTestBase {

    /** POST /account/change-password with the given body, asserting the status; returns the result. */
    private MvcResult changePassword(String token, String current, String next, int expected) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("currentPassword", current);
        body.put("newPassword", next);
        return mockMvc.perform(post("/account/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }

    @Test
    void changePassword_withCorrectCurrent_succeeds_andNewPasswordWorks() throws Exception {
        String email = "cp-happy@test.com";
        String token = registerAndGetToken(email, "MERCHANT", null);

        changePassword(token, "password123", "newpass456", 200);

        // The new password logs in; the old one no longer does.
        loginAndGetToken(email, "newpass456");
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", "password123"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePassword_returnsFreshToken_signsOutOldToken() throws Exception {
        String email = "cp-session@test.com";
        String oldToken = registerAndGetToken(email, "MERCHANT", null);

        MvcResult result = changePassword(oldToken, "password123", "newpass456", 200);
        String newToken = json(result).get("token").asText();

        assertNotEquals(oldToken, newToken, "a fresh token is issued");
        // The old token is now rejected (version bumped), the fresh one works.
        getWithToken("/merchant/stores", newToken, 200);
        getWithToken("/merchant/stores", oldToken, 401);
    }

    @Test
    void changePassword_withWrongCurrent_returns403_andPasswordUnchanged() throws Exception {
        String email = "cp-wrong@test.com";
        String token = registerAndGetToken(email, "MERCHANT", null);

        changePassword(token, "not-my-password", "newpass456", 403);

        // Unchanged: old password still works, the rejected new one does not.
        loginAndGetToken(email, "password123");
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", "newpass456"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePassword_withTooShortNew_returns400_andPasswordUnchanged() throws Exception {
        String email = "cp-short@test.com";
        String token = registerAndGetToken(email, "MERCHANT", null);

        changePassword(token, "password123", "123", 400);

        loginAndGetToken(email, "password123");
    }

    @Test
    void changePassword_withBlankCurrent_returns400() throws Exception {
        String token = registerAndGetToken("cp-blank@test.com", "MERCHANT", null);
        changePassword(token, "", "newpass456", 400);
    }

    @Test
    void changePassword_unauthenticated_isRejected() throws Exception {
        mockMvc.perform(post("/account/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123",
                                "newPassword", "newpass456"))))
                .andExpect(status().isUnauthorized());
    }
}
