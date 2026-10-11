package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Creating a customer may carry optional tags, normalized exactly like update. */
class CustomerCreateTagsIntegrationTest extends IntegrationTestBase {

    private MvcResult create(String token, long storeId, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andReturn();
    }

    @Test
    void createWithTags_roundTrips() throws Exception {
        String t = registerAndGetToken("cust-tags@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Tag Store", "cust-tags-store");

        MvcResult r = create(t, storeId, Map.of(
                "fullName", "Ada", "phoneNumber", "+6590001111",
                "tags", List.of(Map.of("name", "VIP", "color", "orange"),
                                 Map.of("name", "wholesale", "color", "gray"))));

        JsonNode tags = json(r).get("tags");
        assertEquals(2, tags.size());
        assertEquals("VIP", tags.get(0).get("name").asText());
        assertEquals("orange", tags.get(0).get("color").asText());
        assertEquals("wholesale", tags.get(1).get("name").asText());
    }

    @Test
    void createWithoutTags_stillWorks() throws Exception {
        String t = registerAndGetToken("cust-notags@test.com", "MERCHANT", null);
        long storeId = createStore(t, "No Tag Store", "cust-notags-store");

        MvcResult r = create(t, storeId, Map.of("fullName", "Bob", "phoneNumber", "+6590002222"));
        assertEquals(0, json(r).get("tags").size());
    }

    @Test
    void createTags_normalizeLikeUpdate() throws Exception {
        String t = registerAndGetToken("cust-norm@test.com", "MERCHANT", null);
        long storeId = createStore(t, "Norm Store", "cust-norm-store");

        // Trim + case-insensitive dedupe (keep first) + unknown color coerced to gray.
        MvcResult r = create(t, storeId, Map.of(
                "fullName", "Cat", "phoneNumber", "+6590003333",
                "tags", List.of(Map.of("name", "  VIP  ", "color", "orange"),
                                 Map.of("name", "vip", "color", "neon"))));

        JsonNode tags = json(r).get("tags");
        assertEquals(1, tags.size(), "case-insensitive duplicate dropped");
        assertEquals("VIP", tags.get(0).get("name").asText(), "trimmed");
        assertEquals("orange", tags.get(0).get("color").asText());
    }
}
