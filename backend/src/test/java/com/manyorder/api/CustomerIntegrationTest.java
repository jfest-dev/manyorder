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

    // ---------- delete (hard delete for data erasure) ----------

    @Test
    void deleteCustomer_removesThem_butOrdersSurviveWithSnapshot() throws Exception {
        String token = registerAndGetToken("cust-del@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del Store", "cust-del-store");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222"); // same customer, 2 orders

        long customerId = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)),
                "+6591112222").get("id").asLong();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/customers/" + customerId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // Customer is gone from the store list.
        assertEquals(0, json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)).size());

        // But the two orders survive, detached (customerId null) with the name snapshot intact.
        JsonNode orders = json(getWithToken("/merchant/stores/" + storeId + "/orders", token, 200));
        assertEquals(2, orders.size(), "orders survive the customer deletion");
        for (JsonNode o : orders) {
            assertEquals(true, o.get("customerId").isNull(), "order detached from the deleted customer");
            assertEquals("Sam Tan", o.get("customerName").asText(), "contact snapshot survives");
        }
    }

    @Test
    void deleteCustomer_withNoOrders_succeeds() throws Exception {
        String token = registerAndGetToken("cust-del2@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del2 Store", "cust-del2-store");
        MvcResult created = mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "Solo", "phoneNumber", "+6590009999"))))
                .andExpect(status().isCreated()).andReturn();
        long id = json(created).get("id").asLong();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/customers/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertEquals(0, json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)).size());
    }

    @Test
    void deleteCustomer_notInStore_returns404() throws Exception {
        String token = registerAndGetToken("cust-del3@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del3 Store", "cust-del3-store");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/customers/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteCustomer_asStaff_isForbidden() throws Exception {
        String owner = registerAndGetToken("cust-del-owner@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Del Staff Store", "cust-del-staff-store");
        createManualOrder(owner, storeId, "Someone", "+6591113333");
        long customerId = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", owner, 200)),
                "+6591113333").get("id").asLong();

        String staff = registerAndGetToken("cust-del-staff@test.com", "STAFF", "cust-del-staff-store");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/merchant/stores/" + storeId + "/customers/" + customerId)
                        .header("Authorization", "Bearer " + staff))
                .andExpect(status().isForbidden());
    }

    private JsonNode findByPhone(JsonNode arr, String phone) {
        for (JsonNode n : arr) {
            if (phone.equals(n.get("phoneNumber").asText())) return n;
        }
        return null;
    }
}
