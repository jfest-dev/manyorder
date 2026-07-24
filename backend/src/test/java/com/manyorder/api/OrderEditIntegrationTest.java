package com.manyorder.api;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderEditIntegrationTest extends IntegrationTestBase {

    /** (1) Contact/logistics fields are editable at any status — even PREPARING. */
    @Test
    void editContactFields_succeedAtAnyStatus() throws Exception {
        String token = registerAndGetToken("edit-contact@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit Contact Store", "edit-contact-store");
        long orderId = createManualOrder(token, storeId, "Old Name", "+6511110000");

        // Move well past the line-item edit window.
        patchStatus(token, storeId, orderId, "CONFIRMED", 200);
        patchStatus(token, storeId, orderId, "PREPARING", 200);

        Map<String, Object> body = new HashMap<>();
        body.put("customerName", "New Name");
        body.put("phoneNumber", "+6522220000");
        body.put("email", "new@cust.com");
        body.put("notes", "Leave at door");

        MvcResult result = patchOrder(token, storeId, orderId, body, 200);
        var json = json(result);
        assertEquals("New Name", json.get("contactName").asText());
        assertEquals("+6522220000", json.get("contactPhone").asText());
        assertEquals("new@cust.com", json.get("contactEmail").asText());
        assertEquals("Leave at door", json.get("notes").asText());
    }

    /** (2) Line items are editable while PENDING/CONFIRMED; total recomputes from live prices. */
    @Test
    void editLineItems_succeeds_whilePendingOrConfirmed() throws Exception {
        String token = registerAndGetToken("edit-items-ok@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit Items Store", "edit-items-store");
        long productId = createProduct(token, storeId, "Kopi", 3.5);
        long orderId = createManualOrder(token, storeId, "Item Cust", "+6533330000");

        // Still PENDING — allowed. Also verify at CONFIRMED.
        patchStatus(token, storeId, orderId, "CONFIRMED", 200);

        Map<String, Object> body = new HashMap<>();
        body.put("customerName", "Item Cust");
        body.put("items", List.of(Map.of("productId", productId, "quantity", 3)));

        MvcResult result = patchOrder(token, storeId, orderId, body, 200);
        var json = json(result);
        assertEquals(1, json.get("items").size());
        assertEquals(3, json.get("items").get(0).get("quantity").asInt());
        assertEquals(0, new java.math.BigDecimal("10.5")
                .compareTo(json.get("totalAmount").decimalValue()),
                "3 x 3.5 should recompute to 10.5");
    }

    /** (3) Editing line items once PREPARING or later is rejected with 400. */
    @Test
    void editLineItems_returns400_whenPreparingOrLater() throws Exception {
        String token = registerAndGetToken("edit-items-locked@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Locked Items Store", "locked-items-store");
        long productId = createProduct(token, storeId, "Teh", 2.0);
        long orderId = createManualOrder(token, storeId, "Locked Cust", "+6544440000");

        patchStatus(token, storeId, orderId, "CONFIRMED", 200);
        patchStatus(token, storeId, orderId, "PREPARING", 200);

        Map<String, Object> body = new HashMap<>();
        body.put("customerName", "Locked Cust");
        body.put("items", List.of(Map.of("productId", productId, "quantity", 5)));

        patchOrder(token, storeId, orderId, body, 400);
    }

    /** (4) Switching to PICKUP clears the address; DELIVERY without an address saves with null. */
    @Test
    void orderType_pickupClearsAddress_deliveryWithoutAddressSaves() throws Exception {
        String token = registerAndGetToken("edit-type@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Type Store", "type-store");

        // Create a DELIVERY order that has an address.
        Map<String, Object> createBody = new HashMap<>();
        createBody.put("customerName", "Type Cust");
        createBody.put("phoneNumber", "+6555550000");
        createBody.put("orderType", "DELIVERY");
        createBody.put("deliveryAddress", "1 Orchard Rd");
        MvcResult created = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createBody)))
                .andExpect(status().isCreated())
                .andReturn();
        var createdJson = json(created);
        long orderId = createdJson.get("id").asLong();
        assertEquals("DELIVERY", createdJson.get("orderType").asText());
        assertEquals("1 Orchard Rd", createdJson.get("deliveryAddress").asText());

        // Switch to PICKUP — address must be cleared.
        Map<String, Object> toPickup = new HashMap<>();
        toPickup.put("customerName", "Type Cust");
        toPickup.put("orderType", "PICKUP");
        toPickup.put("deliveryAddress", "1 Orchard Rd"); // should be ignored for PICKUP
        var pickupJson = json(patchOrder(token, storeId, orderId, toPickup, 200));
        assertEquals("PICKUP", pickupJson.get("orderType").asText());
        assertTrue(pickupJson.get("deliveryAddress").isNull(), "PICKUP must clear the address");

        // Back to DELIVERY with no address — saves with a null address (non-blocking).
        Map<String, Object> toDeliveryBlank = new HashMap<>();
        toDeliveryBlank.put("customerName", "Type Cust");
        toDeliveryBlank.put("orderType", "DELIVERY");
        var deliveryJson = json(patchOrder(token, storeId, orderId, toDeliveryBlank, 200));
        assertEquals("DELIVERY", deliveryJson.get("orderType").asText());
        assertTrue(deliveryJson.get("deliveryAddress").isNull(),
                "DELIVERY without an address should save with null address");
    }

    // ---- helpers ----

    private long createProduct(String token, long storeId, String name, double price) throws Exception {
        MvcResult result = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", name, "description", "d", "price", price))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).get("id").asLong();
    }

    private MvcResult patchOrder(String token, long storeId, long orderId,
                                 Map<String, Object> body, int expected) throws Exception {
        return mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }
}
