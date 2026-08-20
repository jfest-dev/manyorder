package com.manyorder.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Product add-ons / modifiers + per-item notes (Phase 1 backend):
 *  - modifier groups round-trip through product create/response and are replaced
 *    wholesale on update;
 *  - guest checkout AND manual orders re-derive modifier prices server-side via
 *    the shared ModifierResolver (client sends only ids), and enforce
 *    foreign-id / required / max rules with 400s;
 *  - each ordered line snapshots its chosen modifiers and per-line note, so
 *    history survives a later modifier edit/delete.
 */
class ModifierIntegrationTest extends IntegrationTestBase {

    // A product with a required choose-one Size (Small +0 / Large +2) and an
    // optional, unlimited Add-ons group (Pearls +1 / Grass Jelly +1.50).
    private JsonNode createProductWithModifiers(String token, long storeId, String name, double price)
            throws Exception {
        Map<String, Object> size = new HashMap<>();
        size.put("name", "Size");
        size.put("minSelect", 1);
        size.put("maxSelect", 1);
        size.put("options", List.of(
                Map.of("name", "Small", "priceDelta", 0.00),
                Map.of("name", "Large", "priceDelta", 2.00)));

        Map<String, Object> addons = new HashMap<>();
        addons.put("name", "Add-ons");
        addons.put("minSelect", 0);
        // maxSelect omitted = unlimited
        addons.put("options", List.of(
                Map.of("name", "Pearls", "priceDelta", 1.00),
                Map.of("name", "Grass Jelly", "priceDelta", 1.50)));

        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", name, "price", price,
                                "modifierGroups", List.of(size, addons)))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r);
    }

    /** Pull an option id by group name + option name out of a product response. */
    private long optionId(JsonNode product, String groupName, String optionName) {
        for (JsonNode g : product.get("modifierGroups")) {
            if (g.get("name").asText().equals(groupName)) {
                for (JsonNode o : g.get("options")) {
                    if (o.get("name").asText().equals(optionName)) return o.get("id").asLong();
                }
            }
        }
        throw new AssertionError("option not found: " + groupName + "/" + optionName);
    }

    private MvcResult guestCheckout(long storeId, long productId, int qty,
                                    List<Long> optionIds, String notes, int expected) throws Exception {
        Map<String, Object> item = new HashMap<>();
        item.put("productId", productId);
        item.put("quantity", qty);
        if (optionIds != null) item.put("modifierOptionIds", optionIds);
        if (notes != null) item.put("notes", notes);

        Map<String, Object> body = new HashMap<>(Map.of(
                "merchantId", storeId,
                "customerName", "Guest",
                "customerPhone", "+6588881234",
                "fulfilmentMethod", "PICKUP",
                "items", List.of(item)));
        return mockMvc.perform(post("/public/checkout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().is(expected))
                .andReturn();
    }

    // ---------- product round-trip ----------

    @Test
    void productCreate_roundTripsModifierGroups_withOptionIds() throws Exception {
        String token = registerAndGetToken("mod-create@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod Store", "mod-create-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Milk Tea", 10.00);

        JsonNode groups = product.get("modifierGroups");
        assertEquals(2, groups.size());
        assertEquals("Size", groups.get(0).get("name").asText());
        assertTrue(groups.get(0).get("required").asBoolean());
        assertEquals(1, groups.get(0).get("minSelect").asInt());
        assertEquals(1, groups.get(0).get("maxSelect").asInt());
        assertEquals(2, groups.get(0).get("options").size());
        assertEquals("Small", groups.get(0).get("options").get(0).get("name").asText());
        assertEquals(2.0, groups.get(0).get("options").get(1).get("priceDelta").asDouble(), 0.001);
        // optional group: not required, unlimited (maxSelect null)
        assertEquals("Add-ons", groups.get(1).get("name").asText());
        assertTrue(!groups.get(1).get("required").asBoolean());
        assertTrue(groups.get(1).get("maxSelect").isNull());
    }

    @Test
    void productUpdate_replacesModifiersWholesale() throws Exception {
        String token = registerAndGetToken("mod-update@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod U", "mod-update-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Latte", 6.00);
        long productId = product.get("id").asLong();

        // Replace both groups with a single new one.
        Map<String, Object> temp = new HashMap<>();
        temp.put("name", "Temperature");
        temp.put("minSelect", 1);
        temp.put("maxSelect", 1);
        temp.put("options", List.of(
                Map.of("name", "Hot", "priceDelta", 0.00),
                Map.of("name", "Iced", "priceDelta", 0.50)));

        MvcResult r = mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "modifierGroups", List.of(temp)))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode groups = json(r).get("modifierGroups");
        assertEquals(1, groups.size());
        assertEquals("Temperature", groups.get(0).get("name").asText());
    }

    // ---------- guest checkout money + snapshots ----------

    @Test
    void guestCheckout_appliesModifierDeltas_andCapturesLineNote() throws Exception {
        String token = registerAndGetToken("mod-co@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod CO", "mod-co-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Boba", 10.00);
        long productId = product.get("id").asLong();
        long large = optionId(product, "Size", "Large");     // +2.00
        long pearls = optionId(product, "Add-ons", "Pearls"); // +1.00

        MvcResult r = guestCheckout(storeId, productId, 2, List.of(large, pearls), "less sugar", 201);
        // unit = 10 + 2 + 1 = 13; line = 13 * 2 = 26
        assertEquals(26.0, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(26.0, json(r).get("totalAmount").asDouble(), 0.001);

        JsonNode item = json(r).get("items").get(0);
        assertEquals(13.0, item.get("unitPrice").asDouble(), 0.001);
        assertEquals(26.0, item.get("subtotal").asDouble(), 0.001);
        assertEquals("less sugar", item.get("notes").asText());
        JsonNode mods = item.get("modifiers");
        assertEquals(2, mods.size());
        assertEquals("Size", mods.get(0).get("groupName").asText());
        assertEquals("Large", mods.get(0).get("optionName").asText());
        assertEquals(2.0, mods.get(0).get("priceDelta").asDouble(), 0.001);
    }

    @Test
    void guestCheckout_rejectsForeignOption_missingRequired_andOverMax() throws Exception {
        String token = registerAndGetToken("mod-bad@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod Bad", "mod-bad-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Tea", 10.00);
        long productId = product.get("id").asLong();
        long small = optionId(product, "Size", "Small");
        long large = optionId(product, "Size", "Large");

        // Foreign / unknown option id.
        guestCheckout(storeId, productId, 1, List.of(999999L), null, 400);
        // Required Size not chosen (only optional add-ons context: empty selection).
        guestCheckout(storeId, productId, 1, List.of(), null, 400);
        // Choose-one Size given two options → over max.
        guestCheckout(storeId, productId, 1, List.of(small, large), null, 400);
    }

    @Test
    void orderedLine_snapshotSurvivesModifierDeletion() throws Exception {
        String token = registerAndGetToken("mod-snap@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod Snap", "mod-snap-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Coffee", 5.00);
        long productId = product.get("id").asLong();
        long large = optionId(product, "Size", "Large"); // +2

        MvcResult co = guestCheckout(storeId, productId, 1, List.of(large), null, 201);
        long orderId = json(co).get("orderId").asLong();

        // Merchant wipes all modifiers off the product.
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "modifierGroups", new ArrayList<>()))))
                .andExpect(status().isOk());

        // The historical order still carries the snapshot + its price.
        MvcResult order = mockMvc.perform(get("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode item = json(order).get("items").get(0);
        assertEquals(7.0, item.get("unitPrice").asDouble(), 0.001); // 5 + 2 preserved
        assertEquals("Large", item.get("modifiers").get(0).get("optionName").asText());
    }

    // ---------- manual-order parity ----------

    @Test
    void manualOrder_appliesModifiersAndNotes_throughSharedResolver() throws Exception {
        String token = registerAndGetToken("mod-manual@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod Manual", "mod-manual-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Frappe", 8.00);
        long productId = product.get("id").asLong();
        long large = optionId(product, "Size", "Large");   // +2
        long jelly = optionId(product, "Add-ons", "Grass Jelly"); // +1.50

        Map<String, Object> item = new HashMap<>();
        item.put("productId", productId);
        item.put("quantity", 3);
        item.put("modifierOptionIds", List.of(large, jelly));
        item.put("notes", "extra cold");

        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In",
                                "phoneNumber", "+6588885555",
                                "items", List.of(item)))))
                .andExpect(status().isCreated())
                .andReturn();

        // unit = 8 + 2 + 1.50 = 11.50; line = 11.50 * 3 = 34.50
        assertEquals(34.5, json(r).get("subtotal").asDouble(), 0.001);
        assertEquals(34.5, json(r).get("totalAmount").asDouble(), 0.001);
        JsonNode line = json(r).get("items").get(0);
        assertEquals(11.5, line.get("unitPrice").asDouble(), 0.001);
        assertEquals(34.5, line.get("lineSubtotal").asDouble(), 0.001);
        assertEquals("extra cold", line.get("notes").asText());
        assertEquals(2, line.get("modifiers").size());
    }

    @Test
    void manualOrder_exposesSourceOptionId_andEditRoundTripsModifiers() throws Exception {
        String token = registerAndGetToken("mod-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod Edit", "mod-edit-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Latte", 8.00);
        long productId = product.get("id").asLong();
        long large = optionId(product, "Size", "Large"); // +2

        // Create a manual order with a modifier line.
        Map<String, Object> item = new HashMap<>();
        item.put("productId", productId);
        item.put("quantity", 1);
        item.put("modifierOptionIds", List.of(large));
        MvcResult created = mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In", "phoneNumber", "+6588885555",
                                "items", List.of(item)))))
                .andExpect(status().isCreated())
                .andReturn();
        long orderId = json(created).get("id").asLong();
        // Response exposes sourceOptionId so the edit form can round-trip the choice.
        JsonNode mod = json(created).get("items").get(0).get("modifiers").get(0);
        assertEquals(large, mod.get("sourceOptionId").asLong());

        // Edit the order: bump qty, resend the same modifierOptionIds (as the edit
        // form reconstructs them from sourceOptionId). Modifiers must survive.
        Map<String, Object> editItem = new HashMap<>();
        editItem.put("productId", productId);
        editItem.put("quantity", 2);
        editItem.put("modifierOptionIds", List.of(large));
        MvcResult edited = mockMvc.perform(patch("/merchant/stores/" + storeId + "/orders/" + orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In", "items", List.of(editItem)))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode line = json(edited).get("items").get(0);
        assertEquals(2, line.get("quantity").asInt());
        assertEquals(10.0, line.get("unitPrice").asDouble(), 0.001); // 8 + 2 preserved
        assertEquals(20.0, line.get("lineSubtotal").asDouble(), 0.001);
        assertEquals("Large", line.get("modifiers").get(0).get("optionName").asText());
    }

    @Test
    void manualOrder_rejectsForeignOption() throws Exception {
        String token = registerAndGetToken("mod-manual-bad@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Mod MB", "mod-manual-bad-store");
        JsonNode product = createProductWithModifiers(token, storeId, "Shake", 8.00);
        long productId = product.get("id").asLong();

        Map<String, Object> item = new HashMap<>();
        item.put("productId", productId);
        item.put("quantity", 1);
        item.put("modifierOptionIds", List.of(888888L));

        mockMvc.perform(post("/merchant/stores/" + storeId + "/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName", "Walk In",
                                "phoneNumber", "+6588885555",
                                "items", List.of(item)))))
                .andExpect(status().isBadRequest());
    }
}
