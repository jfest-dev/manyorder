package com.manyorder.api;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The admin permission lockdown: admin is read-only for customers, orders and
 * marketing; for products it may only view and hide/unhide; store suspend/unsuspend
 * stay. Every removed mutation must be blocked (403/404/405), the kept endpoints
 * must work, and a merchant token must get 403 on every admin endpoint.
 */
class AdminLockdownIntegrationTest extends IntegrationTestBase {

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder rb, String body) {
        return rb.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    /** A removed endpoint must not act: 403 (gate), 404 (no path) or 405 (method gone). */
    private void assertBlocked(MockHttpServletRequestBuilder rb) throws Exception {
        int s = mockMvc.perform(rb).andReturn().getResponse().getStatus();
        assertTrue(s == 403 || s == 404 || s == 405, "expected 403/404/405 but was " + s);
    }

    @Test
    void removedAdminMutations_areBlocked_forAdmin() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        String merchant = registerAndGetToken("lock-rm@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Lock Store", "lock-rm-store");
        long productId = createMerchantProduct(merchant, storeId, "Latte", 5.0);
        long orderId = createManualOrder(merchant, storeId, "Buyer", "+6590000001");

        String p = "/admin/merchants/" + storeId + "/products";
        String c = "/admin/merchants/" + storeId + "/customers";
        String d = "/admin/merchants/" + storeId + "/discounts";
        String o = "/admin/merchants/" + storeId + "/orders";

        // Products: no create, edit, reorder or delete.
        assertBlocked(json(post(p), "{\"name\":\"X\",\"price\":1}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(patch(p + "/" + productId), "{\"name\":\"X\"}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(patch(p + "/reorder"), "{\"productIds\":[" + productId + "]}").header("Authorization", "Bearer " + admin));
        assertBlocked(delete(p + "/" + productId).header("Authorization", "Bearer " + admin));

        // Customers: no create, edit or delete.
        assertBlocked(json(post(c), "{\"fullName\":\"B\",\"phoneNumber\":\"+6590000002\"}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(put(c + "/1"), "{\"fullName\":\"B\",\"phoneNumber\":\"+6590000002\"}").header("Authorization", "Bearer " + admin));
        assertBlocked(delete(c + "/1").header("Authorization", "Bearer " + admin));

        // Discounts: no create, edit, reorder or delete.
        assertBlocked(json(post(d), "{\"code\":\"X\",\"type\":\"PERCENTAGE\",\"value\":5}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(patch(d + "/1"), "{\"code\":\"X\",\"type\":\"PERCENTAGE\",\"value\":5}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(patch(d + "/reorder"), "{\"discountIds\":[1]}").header("Authorization", "Bearer " + admin));
        assertBlocked(delete(d + "/1").header("Authorization", "Bearer " + admin));

        // Orders: no status or payment-status change.
        assertBlocked(json(patch(o + "/" + orderId + "/status"), "{\"status\":\"CANCELLED\"}").header("Authorization", "Bearer " + admin));
        assertBlocked(json(patch(o + "/" + orderId + "/payment-status"), "{\"paymentStatus\":\"PAID\"}").header("Authorization", "Bearer " + admin));
    }

    @Test
    void keptAdminEndpoints_work_forAdmin() throws Exception {
        String admin = loginAndGetToken("admin@manyorder.app", SEED_DEMO_PASSWORD);
        String merchant = registerAndGetToken("lock-keep@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Keep Store", "lock-keep-store");
        long productId = createMerchantProduct(merchant, storeId, "Mocha", 6.0);
        createManualOrder(merchant, storeId, "Buyer", "+6590000003");

        String p = "/admin/merchants/" + storeId + "/products";
        // Views.
        getWithToken(p, admin, 200);
        getWithToken(p + "/" + productId, admin, 200);
        getWithToken("/admin/merchants/" + storeId + "/customers", admin, 200);
        getWithToken("/admin/merchants/" + storeId + "/discounts", admin, 200);
        getWithToken("/admin/merchants/" + storeId + "/orders", admin, 200);
        getWithToken("/admin/merchants/" + storeId + "/detail", admin, 200);
        getWithToken("/admin/audit-log?storeId=" + storeId, admin, 200);
        getWithToken("/admin/merchants", admin, 200);

        // Hide a product needs a reason; unhide does not (not a notifiable action).
        String reason = "{\"reason\":\"Policy review\"}";
        mockMvc.perform(json(patch(p + "/" + productId + "/deactivate"), reason).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
        mockMvc.perform(patch(p + "/" + productId + "/activate").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        // Switch a discount off (reason required) / on (no reason).
        long discountId = createMerchantDiscount(merchant, storeId, "LOCK10");
        String d = "/admin/merchants/" + storeId + "/discounts";
        mockMvc.perform(json(patch(d + "/" + discountId + "/deactivate"), reason).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
        mockMvc.perform(patch(d + "/" + discountId + "/activate").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());

        // Store-level suspend / unsuspend stay, each with a reason.
        mockMvc.perform(json(post("/admin/merchants/" + storeId + "/suspend"), reason).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        mockMvc.perform(json(post("/admin/merchants/" + storeId + "/unsuspend"), reason).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
    }

    @Test
    void everyAdminEndpoint_is403_forMerchantToken() throws Exception {
        String merchant = registerAndGetToken("lock-merch@test.com", "MERCHANT", null);
        long storeId = createStore(merchant, "Merch Store", "lock-merch-store");
        String base = "/admin/merchants/" + storeId;

        // A representative GET per area, plus the store list, metrics and audit log.
        for (String url : List.of(base + "/products", base + "/customers", base + "/discounts",
                base + "/orders", base + "/detail", "/admin/merchants", "/admin/metrics",
                "/admin/audit-log")) {
            getWithToken(url, merchant, 403);
        }
        // And kept mutations are gated too.
        mockMvc.perform(patch(base + "/products/1/deactivate").header("Authorization", "Bearer " + merchant))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch(base + "/discounts/1/deactivate").header("Authorization", "Bearer " + merchant))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(base + "/suspend").header("Authorization", "Bearer " + merchant))
                .andExpect(status().isForbidden());
    }

    private long createMerchantProduct(String merchantToken, long storeId, String name, double price) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + merchantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "price", price, "stock", 100))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }

    private long createMerchantDiscount(String merchantToken, long storeId, String code) throws Exception {
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/discounts")
                        .header("Authorization", "Bearer " + merchantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", code, "type", "PERCENTAGE", "value", 10))))
                .andExpect(status().isCreated()).andReturn();
        return json(r).get("id").asLong();
    }
}
