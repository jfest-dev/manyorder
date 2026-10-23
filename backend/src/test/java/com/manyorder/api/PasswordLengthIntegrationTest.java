package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Passwords are capped at 72 bytes (UTF-8) wherever one is set (register, reset,
 * change), with a clear message. Login never checks length, so an existing user
 * whose password is longer still signs in without a 500 (bcrypt compares only the
 * first 72 bytes). Includes a multi-byte case.
 */
class PasswordLengthIntegrationTest extends IntegrationTestBase {

    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    // "A" is one byte; a password of (72 "a" + "1") is 73 bytes.
    private static final String OVER_72_ASCII = "a".repeat(72) + "1";
    private static final String EXACTLY_72_ASCII = "a".repeat(71) + "1";
    // Each U+1F600 is 4 UTF-8 bytes; "1" + 19 emoji = 1 + 76 = 77 bytes, 20 chars.
    private static final String OVER_72_MULTIBYTE = "1" + "😀".repeat(19);

    private MvcResult register(String email, String password) throws Exception {
        Map<String, Object> body = Map.of(
                "fullName", "Len", "email", email, "password", password, "role", "MERCHANT");
        return mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
    }

    @Test
    void register_rejectsPasswordOver72BytesAscii() throws Exception {
        MvcResult r = register("pwlen-ascii@test.com", OVER_72_ASCII);
        assertEquals(400, r.getResponse().getStatus());
        assertTrue(r.getResponse().getContentAsString().contains("72 bytes"), "clear 72-byte message");
    }

    @Test
    void register_acceptsExactly72Bytes() throws Exception {
        assertEquals(200, register("pwlen-exact@test.com", EXACTLY_72_ASCII).getResponse().getStatus());
    }

    @Test
    void register_rejectsMultibytePasswordOver72Bytes() throws Exception {
        MvcResult r = register("pwlen-mb@test.com", OVER_72_MULTIBYTE);
        assertEquals(400, r.getResponse().getStatus());
        assertTrue(r.getResponse().getContentAsString().contains("72 bytes"), "multi-byte counted by bytes");
    }

    @Test
    void changePassword_rejectsOver72Bytes() throws Exception {
        String token = registerAndGetToken("pwlen-change@test.com", "MERCHANT", null);
        MvcResult r = mockMvc.perform(post("/account/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123", "newPassword", OVER_72_ASCII))))
                .andReturn();
        assertEquals(400, r.getResponse().getStatus());
        assertTrue(r.getResponse().getContentAsString().contains("72 bytes"));
    }

    @Test
    void resetPassword_rejectsOver72Bytes_beforeTokenLookup() throws Exception {
        // The length check runs before the token lookup, so an over-length password
        // is rejected with the byte message even with a bogus token.
        MvcResult r = mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", "no-such-token", "newPassword", OVER_72_ASCII))))
                .andReturn();
        assertEquals(400, r.getResponse().getStatus());
        assertTrue(r.getResponse().getContentAsString().contains("72 bytes"));
    }

    @Test
    void login_withLongerExistingPassword_doesNotError() throws Exception {
        // An account whose stored hash was made from a 72-byte password: signing in
        // with a 100-byte password must not 500 (bcrypt truncates to 72 and matches).
        User u = new User("Legacy", "pwlen-login@test.com",
                passwordEncoder.encode("a".repeat(72)), UserRole.MERCHANT);
        userRepository.save(u);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", "pwlen-login@test.com", "password", "a".repeat(100)))))
                .andExpect(status -> assertEquals(200, status.getResponse().getStatus()));
    }
}
