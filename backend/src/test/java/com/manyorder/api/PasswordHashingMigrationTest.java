package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.manyorder.api.domain.passwordreset.PasswordResetMailer;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Password hashing migration to Argon2id. New hashes are Argon2id ({argon2}
 * prefix); an existing bare-bcrypt user still signs in and is upgraded in place on
 * that sign-in; reset and change also produce Argon2id; and a wrong password and an
 * unknown email still return the same 401 and message as before.
 */
class PasswordHashingMigrationTest extends IntegrationTestBase {

    private static final String SIGN_IN_FAILED =
            "Invalid email or password, or too many attempts. Try again in a few minutes.";

    @MockitoSpyBean private PasswordResetMailer mailer;
    @Autowired private UserRepository userRepository;

    private String hashOf(String email) {
        return userRepository.findByEmail(email).orElseThrow().getPasswordHash();
    }

    private int login(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void legacyBcryptUser_signsIn_andIsUpgradedToArgon2() throws Exception {
        String email = "mig-legacy@test.com";
        // A user whose stored hash is bare bcrypt (no {id} prefix), as all current
        // production rows are.
        String bcryptHash = new BCryptPasswordEncoder().encode("legacy-pass1");
        assertTrue(bcryptHash.startsWith("$2"), "precondition: stored hash is bare bcrypt");
        userRepository.save(new User("Legacy", email, bcryptHash, UserRole.MERCHANT));

        assertEquals(200, login(email, "legacy-pass1"), "legacy user still signs in");
        assertTrue(hashOf(email).startsWith("{argon2"), "hash upgraded to Argon2id on sign-in");
        // Still signs in after the upgrade.
        assertEquals(200, login(email, "legacy-pass1"));
    }

    @Test
    void newUser_getsArgon2() throws Exception {
        String email = "mig-new@test.com";
        registerAndGetToken(email, "MERCHANT", null);
        assertTrue(hashOf(email).startsWith("{argon2"), "new registration is Argon2id");
    }

    @Test
    void changePassword_producesArgon2() throws Exception {
        String email = "mig-change@test.com";
        String token = registerAndGetToken(email, "MERCHANT", null);
        mockMvc.perform(post("/account/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123", "newPassword", "changed-pass1"))))
                .andExpect(status().isNoContent());
        assertTrue(hashOf(email).startsWith("{argon2"), "changed password is Argon2id");
    }

    @Test
    void resetPassword_producesArgon2() throws Exception {
        String email = "mig-reset@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        mockMvc.perform(post("/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email))))
                .andExpect(status().isOk());
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendResetLink(eq(email), url.capture());
        String rawToken = url.getValue().substring(url.getValue().indexOf("token=") + "token=".length());

        mockMvc.perform(post("/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "token", rawToken, "newPassword", "resetpass-1"))))
                .andExpect(status().isNoContent());
        assertTrue(hashOf(email).startsWith("{argon2"), "reset password is Argon2id");
    }

    @Test
    void wrongPasswordAndUnknownEmail_behaveTheSame() throws Exception {
        String email = "mig-wrong@test.com";
        registerAndGetToken(email, "MERCHANT", null);

        var wrong = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "nope-wrong1"))))
                .andReturn().getResponse();
        var unknown = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "mig-nobody@test.com", "password", "nope-wrong1"))))
                .andReturn().getResponse();

        assertEquals(401, wrong.getStatus());
        assertEquals(401, unknown.getStatus());
        assertTrue(wrong.getContentAsString().contains(SIGN_IN_FAILED));
        assertTrue(unknown.getContentAsString().contains(SIGN_IN_FAILED));
    }
}
