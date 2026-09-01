package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Customers list derives order activity, and every creation path dedupes by phone. */
class CustomerIntegrationTest extends IntegrationTestBase {

    @Test
    void listsCustomersWithDerivedOrderCount_dedupedByPhone() throws Exception {
        String token = registerAndGetToken("cust-owner@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Cust Store", "cust-store");

        // Two orders for the same phone collapse to one customer with two orders.
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        createManualOrder(token, storeId, "Mei Ling", "+6593334444");

        MvcResult res = getWithToken("/merchant/stores/" + storeId + "/customers", token, 200);
        JsonNode arr = json(res);
        assertEquals(2, arr.size(), "two distinct customers (deduped by phone)");

        JsonNode sam = findByPhone(arr, "+6591112222");
        assertNotNull(sam, "Sam should be present");
        assertEquals(2, sam.get("ordersCount").asInt(), "Sam has two orders");
    }

    @Test
    void addsCustomerManually_andRejectsDuplicatePhone() throws Exception {
        String token = registerAndGetToken("cust-add@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Add Store", "add-store");

        // Existing customer via the order path.
        createManualOrder(token, storeId, "Existing Person", "+6590000001");

        // Manual add with a new phone succeeds.
        mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "New Person", "phoneNumber", "+6590000002", "email", "new@test.com"))))
                .andExpect(status().isCreated());

        // Manual add with the phone that already exists (from the order) is rejected.
        mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Dupe", "phoneNumber", "+6590000001"))))
                .andExpect(status().isConflict());
    }

    private JsonNode findByPhone(JsonNode arr, String phone) {
        for (JsonNode n : arr) {
            if (phone.equals(n.get("phoneNumber").asText())) return n;
        }
        return null;
    }
}
