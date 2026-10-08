package com.manyorder.api;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.persistence.EntityManagerFactory;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Measures how many SQL statements each read endpoint fires for the seeded demo
 * store, so the batch-fetch change can be reported with before/after numbers.
 *
 * <p>Not an assertion test — it prints {@code QUERYCOUNT|<endpoint>|<n>} lines
 * that the build log captures. It hits the real HTTP endpoints through MockMvc,
 * so serialization-time lazy loads (under open-in-view) are counted too.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class QueryCountIT extends IntegrationTestBase {

    @Autowired private EntityManagerFactory emf;

    private Statistics stats() {
        return emf.unwrap(SessionFactory.class).getStatistics();
    }

    /** Runs an authenticated-or-public GET and returns the SQL statement count for just that request. */
    private long countGet(String url, String token) throws Exception {
        Statistics s = stats();
        s.clear();
        var req = get(url);
        if (token != null) req.header("Authorization", "Bearer " + token);
        mockMvc.perform(req).andExpect(status().isOk());
        return s.getPrepareStatementCount();
    }

    @Test
    void measure() throws Exception {
        String merchantToken = loginAndGetToken("manyorder.app@gmail.com", "password123");
        String adminToken = loginAndGetToken("admin@manyorder.app", "password123");

        // The demo "Kiri Brew" store id doubles as the storefront merchantId.
        JsonNode stores = json(getWithToken("/merchant/stores", merchantToken, 200)).get("stores");
        long storeId = -1;
        for (JsonNode store : stores) {
            if ("Kiri Brew".equals(store.get("name").asText())) {
                storeId = store.get("id").asLong();
                break;
            }
        }
        if (storeId < 0) storeId = stores.get(0).get("id").asLong();

        long products = countGet("/public/storefront/" + storeId + "/products", null);
        long offers = countGet("/public/storefront/" + storeId + "/offers", null);
        long merchantOrders = countGet("/merchant/stores/" + storeId + "/orders", merchantToken);
        long merchantProducts = countGet("/merchant/stores/" + storeId + "/products", merchantToken);
        long merchantCustomers = countGet("/merchant/stores/" + storeId + "/customers", merchantToken);
        long adminMerchants = countGet("/admin/merchants", adminToken);

        System.out.println("QUERYCOUNT|storefront-products|" + products);
        System.out.println("QUERYCOUNT|storefront-offers|" + offers);
        System.out.println("QUERYCOUNT|merchant-orders|" + merchantOrders);
        System.out.println("QUERYCOUNT|merchant-products|" + merchantProducts);
        System.out.println("QUERYCOUNT|merchant-customers|" + merchantCustomers);
        System.out.println("QUERYCOUNT|admin-merchants|" + adminMerchants);
    }
}
