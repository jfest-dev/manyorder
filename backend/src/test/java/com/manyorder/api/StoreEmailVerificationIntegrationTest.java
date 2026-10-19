package com.manyorder.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.storeemailverification.StoreEmailConfirmationMailer;
import com.manyorder.api.domain.storeemailverification.StoreEmailVerificationToken;
import com.manyorder.api.domain.storeemailverification.StoreEmailVerificationTokenRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.atLeastOnce;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Store contact-email confirmation: send, confirm, unverify-on-change, owner-only, and rate limits. */
class StoreEmailVerificationIntegrationTest extends IntegrationTestBase {

    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private StoreEmailConfirmationMailer mailer;
    @Autowired private StoreEmailVerificationTokenRepository tokenRepo;
    @Autowired private MerchantRepository merchantRepo;

    private static String sha256Hex(String raw) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private void setEmail(String token, long storeId, String email) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"storeEmail\":\"" + email + "\"}"))
                .andExpect(status().isOk());
    }

    private boolean emailVerified(String token, long storeId) throws Exception {
        JsonNode list = json(getWithToken("/merchant/stores", token, 200)).get("stores");
        for (JsonNode s : list) if (s.get("id").asLong() == storeId) return s.get("emailVerified").asBoolean();
        throw new AssertionError("store not found");
    }

    @Test
    void confirm_marksVerified_thenChangingEmailUnverifies() throws Exception {
        String owner = registerAndGetToken("sev-a@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "SEV A", "sev-a-store");

        // Setting a new store email auto-sends a confirmation.
        setEmail(owner, storeId, "shop-a@test.com");
        assertFalse(emailVerified(owner, storeId), "not verified until confirmed");
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(mailer, atLeastOnce()).sendConfirmation(any(), eq("shop-a@test.com"), url.capture());
        String token = url.getValue().substring(url.getValue().indexOf("token=") + 6);

        // Confirm with the token -> verified.
        mockMvc.perform(post("/public/store-email/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isOk());
        assertTrue(emailVerified(owner, storeId), "verified after confirm");

        // Reusing the same token fails (single use); a bogus token fails too; both generic 400.
        mockMvc.perform(post("/public/store-email/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isBadRequest());
        mockMvc.perform(post("/public/store-email/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"not-a-real-token\"}")).andExpect(status().isBadRequest());

        // Changing the store email makes it unverified again (comparison rule).
        setEmail(owner, storeId, "shop-a-2@test.com");
        assertFalse(emailVerified(owner, storeId), "changing the address unverifies");
    }

    @Test
    void expiredToken_isRejected_genericError() throws Exception {
        String owner = registerAndGetToken("sev-b@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "SEV B", "sev-b-store");
        Merchant merchant = merchantRepo.findById(storeId).orElseThrow();
        tokenRepo.save(new StoreEmailVerificationToken(
                merchant, "shop-b@test.com", sha256Hex("expired-raw"), LocalDateTime.now().minusHours(1)));

        mockMvc.perform(post("/public/store-email/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"expired-raw\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void sendConfirmation_isOwnerOnly() throws Exception {
        String owner = registerAndGetToken("sev-c@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "SEV C", "sev-c-store");
        setEmail(owner, storeId, "shop-c@test.com");
        String stranger = registerAndGetToken("sev-c-stranger@test.com", "MERCHANT", null);

        int status = mockMvc.perform(post("/merchant/stores/" + storeId + "/email/confirmation")
                .header("Authorization", "Bearer " + stranger)).andReturn().getResponse().getStatus();
        assertTrue(status == 403 || status == 404, "a non-owner cannot request, was " + status);
    }

    @Test
    void failedSend_doesNotBreakSavingTheStore() throws Exception {
        doThrow(new RuntimeException("smtp down")).when(mailer).sendConfirmation(any(), any(), any());
        String owner = registerAndGetToken("sev-d@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "SEV D", "sev-d-store");

        setEmail(owner, storeId, "shop-d@test.com"); // must still return 200 despite the failing send
        JsonNode list = json(getWithToken("/merchant/stores", owner, 200)).get("stores");
        boolean saved = false;
        for (JsonNode s : list) if (s.get("id").asLong() == storeId) saved = "shop-d@test.com".equals(s.get("email").asText());
        assertTrue(saved, "the store email saved even though the confirmation send failed");
    }

    @Test
    void rateLimits_perStoreAndPerAddress() throws Exception {
        String owner = registerAndGetToken("sev-e@test.com", "MERCHANT", null);
        long storeA = createStore(owner, "SEV E", "sev-e-store");
        long storeB = createStore(owner, "SEV E2", "sev-e2-store");

        // Set the same address on both, directly, so auto-send does not skew the counts.
        Merchant a = merchantRepo.findById(storeA).orElseThrow();
        a.setEmail("ratelimit@test.com"); merchantRepo.save(a);
        Merchant b = merchantRepo.findById(storeB).orElseThrow();
        b.setEmail("ratelimit@test.com"); merchantRepo.save(b);

        String send = "/merchant/stores/" + storeA + "/email/confirmation";
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post(send).header("Authorization", "Bearer " + owner)).andExpect(status().isNoContent());
        }
        // Fourth to the same store exceeds the per-store limit (3 / 15 min).
        mockMvc.perform(post(send).header("Authorization", "Bearer " + owner)).andExpect(status().isTooManyRequests());

        // Store B has sent none, but the address already got 3 today: the per-address cap blocks it.
        mockMvc.perform(post("/merchant/stores/" + storeB + "/email/confirmation")
                .header("Authorization", "Bearer " + owner)).andExpect(status().isTooManyRequests());
    }
}
