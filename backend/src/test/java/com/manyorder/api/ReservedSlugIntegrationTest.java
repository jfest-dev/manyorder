package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.merchant.SlugService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reserved store slugs and the 50-character cap. Every reserved name is rejected
 * on create and on rename (case-insensitively), an over-length slug is rejected,
 * and a store that already holds a now-reserved slug keeps working.
 */
class ReservedSlugIntegrationTest extends IntegrationTestBase {

    @Autowired private MerchantRepository merchantRepository;

    private int createStatus(String token, String name, String slug) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("storeName", name);
        if (slug != null) body.put("slug", slug);
        return mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn().getResponse().getStatus();
    }

    private int renameStatus(String token, long storeId, String slug) throws Exception {
        return mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("slug", slug))))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void everyReservedSlug_isRejectedOnCreate() throws Exception {
        String token = registerAndGetToken("reserved-create@test.com", "MERCHANT", null);
        for (String reserved : SlugService.RESERVED) {
            // Rejected with a 4xx; none of these attempts creates a store, so the
            // per-owner store limit is never consumed.
            int status = createStatus(token, "Store " + reserved, reserved);
            assertEquals(400, status, "reserved slug rejected on create: " + reserved);
        }
    }

    @Test
    void everyReservedSlug_isRejectedOnRename() throws Exception {
        String token = registerAndGetToken("reserved-rename@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Rename Me", "rename-me-store");
        for (String reserved : SlugService.RESERVED) {
            assertEquals(400, renameStatus(token, storeId, reserved),
                    "reserved slug rejected on rename: " + reserved);
        }
    }

    @Test
    void reservedSlug_isRejectedCaseInsensitively() throws Exception {
        String token = registerAndGetToken("reserved-case@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Case Store", "case-store");
        // Mixed/upper case variants of a reserved name are rejected too.
        assertEquals(400, createStatus(token, "Admin Store", "ADMIN"));
        assertEquals(400, createStatus(token, "Admin Store", "Admin"));
        assertEquals(400, renameStatus(token, storeId, "ADMIN"));
    }

    @Test
    void overLengthSlug_isRejected() throws Exception {
        String token = registerAndGetToken("reserved-len@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Len Store", "len-store");
        String tooLong = "a".repeat(51);
        assertEquals(400, createStatus(token, "Long Store", tooLong), "51-char slug rejected on create");
        assertEquals(400, renameStatus(token, storeId, tooLong), "51-char slug rejected on rename");
        // Exactly 50 is allowed.
        assertEquals(201, createStatus(token, "Fifty Store", "a".repeat(50)), "50-char slug allowed");
    }

    @Test
    void grandfatheredReservedSlug_stillResolves() throws Exception {
        String token = registerAndGetToken("reserved-grand@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Grand Store", "grand-store");

        // Simulate a store created before the name was reserved by setting the slug
        // directly, bypassing the create guard. It must stay reachable.
        Merchant merchant = merchantRepository.findById(storeId).orElseThrow();
        merchant.setSlug("admin");
        merchantRepository.save(merchant);

        mockMvc.perform(get("/public/stores/admin"))
                .andExpect(status().isOk());
    }
}
