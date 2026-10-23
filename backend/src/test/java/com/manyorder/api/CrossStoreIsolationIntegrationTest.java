package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Cross-store isolation for customers and discounts. Owner B and staff of store B
 * cannot read, update or delete owner A's real customer and discount by their real
 * ids. Owner B gets 404 everywhere (missing or foreign both look "not found");
 * staff gets 404 when reading another store and 403 on write endpoints (owner-only,
 * blocked by role before the id is even looked up).
 */
class CrossStoreIsolationIntegrationTest extends IntegrationTestBase {

    private static int seq = 0;

    private String tokenA, tokenB, staffB;
    private long storeA, storeB;
    private long customerA, discountA;

    @BeforeEach
    void setUp() throws Exception {
        String n = "iso" + (seq++) + "-" + System.nanoTime();

        tokenA = registerAndGetToken(n + "-a@test.com", "MERCHANT", null);
        storeA = createStore(tokenA, "Store A " + n, n + "-store-a");
        // A real customer in store A (created via a manual order) and a real discount.
        createManualOrder(tokenA, storeA, "Cust A", "+6590000001");
        JsonNode custList = json(getWithToken("/merchant/stores/" + storeA + "/customers", tokenA, 200));
        customerA = custList.get(0).get("id").asLong();
        discountA = createDiscountA();

        tokenB = registerAndGetToken(n + "-b@test.com", "MERCHANT", null);
        storeB = createStore(tokenB, "Store B " + n, n + "-store-b");
        staffB = registerAndGetToken(n + "-staff-b@test.com", "STAFF", n + "-store-b");
    }

    private long createDiscountA() throws Exception {
        var r = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/merchant/stores/" + storeA + "/discounts")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "code", "savea", "name", "A Only", "type", "PERCENTAGE", "value", 10))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private int statusOf(org.springframework.test.web.servlet.RequestBuilder rb) throws Exception {
        return mockMvc.perform(rb).andReturn().getResponse().getStatus();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder auth(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder rb, String token) {
        return rb.header("Authorization", "Bearer " + token);
    }

    private final String customerBody = "{\"fullName\":\"X\",\"phoneNumber\":\"+6599990000\"}";

    // ---------- owner B ----------

    @Test
    void ownerB_cannotReadUpdateOrDeleteOwnerAsCustomer() throws Exception {
        // Read: listing store A is 404 (not the owner).
        assertEquals(404, statusOf(auth(get("/merchant/stores/" + storeA + "/customers"), tokenB)));
        // Update/delete A's customer id through B's own store: child not in B -> 404.
        assertEquals(404, statusOf(auth(put("/merchant/stores/" + storeB + "/customers/" + customerA), tokenB)
                .contentType(MediaType.APPLICATION_JSON).content(customerBody)));
        assertEquals(404, statusOf(auth(delete("/merchant/stores/" + storeB + "/customers/" + customerA), tokenB)));
        // And through store A (not the owner) -> 404.
        assertEquals(404, statusOf(auth(delete("/merchant/stores/" + storeA + "/customers/" + customerA), tokenB)));
    }

    @Test
    void ownerB_cannotReadUpdateOrDeleteOwnerAsDiscount() throws Exception {
        assertEquals(404, statusOf(auth(get("/merchant/stores/" + storeA + "/discounts"), tokenB)));
        assertEquals(404, statusOf(auth(patch("/merchant/stores/" + storeB + "/discounts/" + discountA), tokenB)
                .contentType(MediaType.APPLICATION_JSON).content("{}")));
        assertEquals(404, statusOf(auth(delete("/merchant/stores/" + storeB + "/discounts/" + discountA), tokenB)));
        assertEquals(404, statusOf(auth(delete("/merchant/stores/" + storeA + "/discounts/" + discountA), tokenB)));
    }

    // ---------- staff of store B ----------

    @Test
    void staffB_cannotReadOwnerAsData_404() throws Exception {
        // Not a member of store A: reads are 404.
        assertEquals(404, statusOf(auth(get("/merchant/stores/" + storeA + "/customers"), staffB)));
        assertEquals(404, statusOf(auth(get("/merchant/stores/" + storeA + "/discounts"), staffB)));
        // Store B carries none of A's data.
        mockMvc.perform(auth(get("/merchant/stores/" + storeB + "/customers"), staffB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(auth(get("/merchant/stores/" + storeB + "/discounts"), staffB))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void staffB_cannotWriteAnyCustomerOrDiscount_403() throws Exception {
        // Update/delete are owner-only, so staff is blocked by role (403) before the
        // store or id is checked. Either way staff cannot touch A's records.
        assertEquals(403, statusOf(auth(put("/merchant/stores/" + storeB + "/customers/" + customerA), staffB)
                .contentType(MediaType.APPLICATION_JSON).content(customerBody)));
        assertEquals(403, statusOf(auth(delete("/merchant/stores/" + storeB + "/discounts/" + discountA), staffB)));
    }
}
