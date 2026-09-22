package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.manyorder.api.domain.customer.CustomerPhoneBackfill;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Customers list derives order activity, and every creation path dedupes by phone. */
class CustomerIntegrationTest extends IntegrationTestBase {

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired CustomerPhoneBackfill customerPhoneBackfill;

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

    // ---------- edit (full-record replace, dedupe excluding self) ----------

    /** PUT an edit to a customer, returning the result for the caller to assert on. */
    private MvcResult putCustomer(String token, long storeId, long customerId, Map<String, String> body) throws Exception {
        return mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/merchant/stores/" + storeId + "/customers/" + customerId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
    }

    @Test
    void updateCustomer_changesNamePhoneEmail_succeeds() throws Exception {
        String token = registerAndGetToken("cust-edit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit Store", "cust-edit-store");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        long id = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)),
                "+6591112222").get("id").asLong();

        MvcResult res = putCustomer(token, storeId, id,
                Map.of("fullName", "Samuel Tan", "phoneNumber", "+6599998888", "email", "samuel@test.com"));
        assertEquals(200, res.getResponse().getStatus());
        JsonNode updated = json(res);
        assertEquals("Samuel Tan", updated.get("fullName").asText());
        assertEquals("+6599998888", updated.get("phoneNumber").asText());
        assertEquals("samuel@test.com", updated.get("email").asText());
        assertEquals(1, updated.get("ordersCount").asInt(), "derived order stats survive the edit");

        // Persisted: the list reflects the new details.
        JsonNode list = json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200));
        assertEquals(1, list.size());
        assertEquals("Samuel Tan", list.get(0).get("fullName").asText());
    }

    @Test
    void updateCustomer_nameOnly_keepsSamePhone_notSelfRejected() throws Exception {
        String token = registerAndGetToken("cust-edit2@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit2 Store", "cust-edit2-store");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        long id = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)),
                "+6591112222").get("id").asLong();

        // Re-saving the same phone must not collide with the customer's own record.
        MvcResult res = putCustomer(token, storeId, id,
                Map.of("fullName", "Sam T.", "phoneNumber", "+6591112222"));
        assertEquals(200, res.getResponse().getStatus());
        assertEquals("Sam T.", json(res).get("fullName").asText());
    }

    @Test
    void updateCustomer_phoneCollisionWithAnother_returns409() throws Exception {
        String token = registerAndGetToken("cust-edit3@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit3 Store", "cust-edit3-store");
        createManualOrder(token, storeId, "Person A", "+6590000001");
        createManualOrder(token, storeId, "Person B", "+6590000002");
        JsonNode list = json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200));
        long idA = findByPhone(list, "+6590000001").get("id").asLong();

        // Editing A to B's phone must be rejected.
        MvcResult res = putCustomer(token, storeId, idA,
                Map.of("fullName", "Person A", "phoneNumber", "+6590000002"));
        assertEquals(409, res.getResponse().getStatus());
    }

    @Test
    void updateCustomer_emailCollisionWithAnother_returns409() throws Exception {
        String token = registerAndGetToken("cust-edit4@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit4 Store", "cust-edit4-store");
        // Two customers added with distinct emails via the manual-add endpoint.
        mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "A", "phoneNumber", "+6590000011", "email", "a@test.com"))))
                .andExpect(status().isCreated());
        MvcResult bCreated = mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "B", "phoneNumber", "+6590000012", "email", "b@test.com"))))
                .andExpect(status().isCreated()).andReturn();
        long idB = json(bCreated).get("id").asLong();

        // Editing B to A's email must be rejected.
        MvcResult res = putCustomer(token, storeId, idB,
                Map.of("fullName", "B", "phoneNumber", "+6590000012", "email", "a@test.com"));
        assertEquals(409, res.getResponse().getStatus());
    }

    @Test
    void updateCustomer_notInStore_returns404() throws Exception {
        String token = registerAndGetToken("cust-edit5@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit5 Store", "cust-edit5-store");
        MvcResult res = putCustomer(token, storeId, 999999L,
                Map.of("fullName", "Ghost", "phoneNumber", "+6591230000"));
        assertEquals(404, res.getResponse().getStatus());
    }

    @Test
    void updateCustomer_asStaff_isForbidden() throws Exception {
        String owner = registerAndGetToken("cust-edit-owner@test.com", "MERCHANT", null);
        long storeId = createStore(owner, "Edit Staff Store", "cust-edit-staff-store");
        createManualOrder(owner, storeId, "Someone", "+6591113333");
        long id = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", owner, 200)),
                "+6591113333").get("id").asLong();

        String staff = registerAndGetToken("cust-edit-staff@test.com", "STAFF", "cust-edit-staff-store");
        MvcResult res = putCustomer(staff, storeId, id,
                Map.of("fullName", "Changed", "phoneNumber", "+6591113333"));
        assertEquals(403, res.getResponse().getStatus());
    }

    @Test
    void updateCustomer_doesNotChangePastOrderSnapshot() throws Exception {
        String token = registerAndGetToken("cust-edit6@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Edit6 Store", "cust-edit6-store");
        createManualOrder(token, storeId, "Sam Tan", "+6591112222");
        long id = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)),
                "+6591112222").get("id").asLong();

        // Edit the live customer's name and phone.
        putCustomer(token, storeId, id,
                Map.of("fullName", "Samuel Tan", "phoneNumber", "+6599998888"));

        // The past order keeps its point-in-time snapshot, still linked by id.
        JsonNode orders = json(getWithToken("/merchant/stores/" + storeId + "/orders", token, 200));
        assertEquals(1, orders.size());
        assertEquals("Sam Tan", orders.get(0).get("customerName").asText(), "order snapshot is unchanged by the edit");
        assertEquals("+6591112222", orders.get(0).get("contactPhone").asText(), "contact phone snapshot unchanged");
        assertEquals(id, orders.get(0).get("customerId").asLong(), "order still linked to the same customer id");
    }

    // ---------- phone normalization (digits-only identity match) ----------

    @Test
    void phoneDedupe_ignoresFormatting_acrossOrders() throws Exception {
        String token = registerAndGetToken("cust-norm@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Norm", "cust-norm-store");
        // Same number, three different formattings -> one customer with three orders.
        createManualOrder(token, storeId, "Sam Tan", "+65 8123 4567");
        createManualOrder(token, storeId, "Sam Tan", "+6581234567");
        createManualOrder(token, storeId, "Sam Tan", "(+65) 8123-4567");

        JsonNode arr = json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200));
        assertEquals(1, arr.size(), "same number, different formatting -> one customer");
        assertEquals(3, arr.get(0).get("ordersCount").asInt(), "all three orders on that one customer");
    }

    @Test
    void manualAdd_dedupe_ignoresFormatting() throws Exception {
        String token = registerAndGetToken("cust-normadd@test.com", "MERCHANT", null);
        long storeId = createStore(token, "NormAdd", "cust-normadd-store");
        mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "A", "phoneNumber", "+65 8123 4567"))))
                .andExpect(status().isCreated());
        // Same number, different spacing -> rejected as a duplicate.
        mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "A2", "phoneNumber", "+6581234567"))))
                .andExpect(status().isConflict());
    }

    @Test
    void editCustomer_dedupe_ignoresFormatting() throws Exception {
        String token = registerAndGetToken("cust-normedit@test.com", "MERCHANT", null);
        long storeId = createStore(token, "NormEdit", "cust-normedit-store");
        createManualOrder(token, storeId, "Person A", "+6590000001");
        createManualOrder(token, storeId, "Person B", "+6590000002");
        long idB = findByPhone(json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200)),
                "+6590000002").get("id").asLong();

        // Editing B to A's number in a different format collides with A.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/merchant/stores/" + storeId + "/customers/" + idB)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "Person B", "phoneNumber", "+65 9000 0001"))))
                .andExpect(status().isConflict());
    }

    @Test
    void backfill_populatesNormalized_soOldRowsMatchAgain() throws Exception {
        String token = registerAndGetToken("cust-backfill@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Backfill", "cust-backfill-store");
        createManualOrder(token, storeId, "Old Sam", "+6588887777");

        // Simulate a pre-migration row: null out the normalized column.
        int nulled = jdbcTemplate.update("UPDATE customers SET phone_normalized = NULL WHERE phone_number = ?", "+6588887777");
        assertEquals(1, nulled);

        // Run the one-time backfill.
        customerPhoneBackfill.run(null);

        // A new order with the same number differently formatted now dedupes to it.
        createManualOrder(token, storeId, "Old Sam", "+65 8888 7777");
        JsonNode arr = json(getWithToken("/merchant/stores/" + storeId + "/customers", token, 200));
        assertEquals(1, arr.size(), "backfilled row matches the reformatted number -> still one customer");
        assertEquals(2, arr.get(0).get("ordersCount").asInt());
    }

    private JsonNode findByPhone(JsonNode arr, String phone) {
        for (JsonNode n : arr) {
            if (phone.equals(n.get("phoneNumber").asText())) return n;
        }
        return null;
    }

    // ---------- tags ----------

    @Test
    void update_setsNormalizedTags_nullLeavesUnchanged_emptyClears() throws Exception {
        String token = registerAndGetToken("cust-tags@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Tags Store", "cust-tags-store");
        long id = json(mockMvc.perform(post("/merchant/stores/" + storeId + "/customers")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "Tagged", "phoneNumber", "+6590007000"))))
                .andExpect(status().isCreated()).andReturn()).get("id").asLong();

        // Messy input: case-insensitive dupes, surrounding spaces, blanks — all normalized.
        JsonNode updated = putCustomer(token, storeId, id,
                java.util.List.of("VIP", " vip ", "Wholesale", "  ", "VIP"));
        assertEquals(java.util.List.of("VIP", "Wholesale"), tagsOf(updated), "deduped, trimmed, order kept");

        // A later update with NO tags key leaves them unchanged.
        JsonNode noTags = json(mockMvc.perform(put("/merchant/stores/" + storeId + "/customers/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("fullName", "Tagged", "phoneNumber", "+6590007000"))))
                .andExpect(status().isOk()).andReturn());
        assertEquals(java.util.List.of("VIP", "Wholesale"), tagsOf(noTags), "null tags = unchanged");

        // An empty list clears them.
        assertTrue(tagsOf(putCustomer(token, storeId, id, java.util.List.of())).isEmpty(), "empty list clears");
    }

    private JsonNode putCustomer(String token, long storeId, long id, java.util.List<String> tags) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("fullName", "Tagged");
        body.put("phoneNumber", "+6590007000");
        body.put("tags", tags);
        return json(mockMvc.perform(put("/merchant/stores/" + storeId + "/customers/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn());
    }

    private java.util.List<String> tagsOf(JsonNode customer) {
        java.util.List<String> out = new java.util.ArrayList<>();
        customer.get("tags").forEach(n -> out.add(n.asText()));
        return out;
    }
}
