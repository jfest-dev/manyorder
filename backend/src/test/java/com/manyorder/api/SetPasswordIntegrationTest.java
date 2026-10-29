package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.common.Passwords;
import com.manyorder.api.config.JwtUtil;
import com.manyorder.api.domain.passwordreset.PasswordResetMailer;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * No-usable-password accounts (created or taken over by Google). Password sign-in
 * fails cleanly (never a 500 from the sentinel), /account reports hasPassword=false,
 * change-password is refused, and "Set a password" emails a reset link. A normal
 * account reports hasPassword=true.
 */
class SetPasswordIntegrationTest extends IntegrationTestBase {

    @Autowired private UserRepository userRepository;
    @Autowired private JwtUtil jwtUtil;
    @MockitoSpyBean private PasswordResetMailer mailer;

    private User createGoogleUser(String email) {
        User u = new User("Google User", email, Passwords.NO_PASSWORD, UserRole.MERCHANT);
        u.setVerified(true);
        return userRepository.save(u);
    }

    private String tokenFor(User u) {
        return jwtUtil.generateToken(u.getId(), u.getEmail(), u.getRole().name(), false, u.tokenVersion());
    }

    @Test
    void passwordSignInFailsCleanlyForANoPasswordAccount() throws Exception {
        createGoogleUser("sp-login@test.com");
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "sp-login@test.com", "password", "anything1"))))
                .andExpect(status().isUnauthorized()); // not a 500 from the sentinel
    }

    @Test
    void accountReportsHasPasswordFalseForGoogle_trueForNormal() throws Exception {
        String googleToken = tokenFor(createGoogleUser("sp-flag@test.com"));
        MvcResult g = getWithToken("/account", googleToken, 200);
        assertFalse(json(g).get("hasPassword").asBoolean(), "google account has no usable password");

        String normalToken = registerAndGetToken("sp-normal@test.com", "MERCHANT", null);
        MvcResult n = getWithToken("/account", normalToken, 200);
        assertTrue(json(n).get("hasPassword").asBoolean(), "registered account has a password");
    }

    @Test
    void changePasswordIsRefusedWithoutAUsablePassword() throws Exception {
        String token = tokenFor(createGoogleUser("sp-change@test.com"));
        mockMvc.perform(post("/account/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "whatever1", "newPassword", "a-new-password-1"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void setPasswordLinkEmailsAResetLinkToTheOwnAddress() throws Exception {
        String email = "sp-setlink@test.com";
        String token = tokenFor(createGoogleUser(email));
        mockMvc.perform(post("/account/password-reset-link").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        verify(mailer, times(1)).sendResetLink(eq(email), any());
    }
}
