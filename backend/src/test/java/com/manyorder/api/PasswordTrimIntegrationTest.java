package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Leading/trailing whitespace is trimmed consistently at register and login, so a
 * fat-fingered space never bakes into the stored hash or blocks sign-in.
 */
class PasswordTrimIntegrationTest extends IntegrationTestBase {

    private void register(String email, String password) throws Exception {
        mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Spacey", "email", email, "password", password, "role", "MERCHANT"))))
                .andExpect(status().isOk());
    }

    private void login(String email, String password, int expected) throws Exception {
        mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().is(expected));
    }

    @Test
    void whitespaceAroundPasswordIsTrimmed_atRegisterAndLogin() throws Exception {
        // Registered WITH surrounding spaces...
        register("spacey@test.com", "  password123  ");

        login("spacey@test.com", "password123", 200);        // ...login with no spaces works
        login("spacey@test.com", "   password123   ", 200);  // ...and with spaces (login trims too)
        login("spacey@test.com", "password124", 401);        // a genuinely wrong password still fails
    }
}
