package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Password whitespace rules:
 *  - set-password points (register, reset, change) reject ANY whitespace with
 *    400 "Password can't contain spaces.";
 *  - verify points (login) still trim, so a pasted trailing space signs in;
 *  - a genuinely wrong password still 401s.
 */
class PasswordTrimIntegrationTest extends IntegrationTestBase {

    private static final String NO_SPACES = "Password can't contain spaces.";

    private MvcResult register(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "fullName", "U", "email", email, "password", password, "role", "MERCHANT")))).andReturn();
    }

    private int login(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void register_rejectsWhitespaceAnywhere() throws Exception {
        MvcResult mid = register("pw-mid@test.com", "pass word123");   // interior space
        assertEquals(400, mid.getResponse().getStatus());
        assertEquals(NO_SPACES, json(mid).get("message").asText());

        assertEquals(400, register("pw-lead@test.com", " password123").getResponse().getStatus());   // leading
        assertEquals(400, register("pw-trail@test.com", "password123 ").getResponse().getStatus());   // trailing
    }

    @Test
    void login_trimsTrailingSpace_butRejectsWrongPassword() throws Exception {
        assertEquals(200, register("pw-ok@test.com", "password123").getResponse().getStatus()); // clean register
        assertEquals(200, login("pw-ok@test.com", "password123 "));   // trailing space trimmed at login
        assertEquals(401, login("pw-ok@test.com", "password124"));    // genuinely wrong
    }

    @Test
    void resetPassword_rejectsWhitespace() throws Exception {
        MvcResult r = mockMvc.perform(post("/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("token", "dummy-token", "newPassword", "pass word123"))))
                .andReturn();
        assertEquals(400, r.getResponse().getStatus());
        assertEquals(NO_SPACES, json(r).get("message").asText());
    }

    @Test
    void changePassword_rejectsWhitespace() throws Exception {
        String token = registerAndGetToken("pw-change@test.com", "MERCHANT", null);
        MvcResult r = mockMvc.perform(post("/account/change-password")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("currentPassword", "password123", "newPassword", "pass word123"))))
                .andReturn();
        assertEquals(400, r.getResponse().getStatus());
        assertEquals(NO_SPACES, json(r).get("message").asText());
    }
}
