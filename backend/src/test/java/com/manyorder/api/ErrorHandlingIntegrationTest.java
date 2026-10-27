package com.manyorder.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * Regression cover for the bug where an unhandled server-side error on a
 * secured endpoint was masked as an empty-body 401.
 *
 * <p>Mechanism: an exception escaping the DispatcherServlet triggers the
 * container's internal ERROR dispatch to {@code /error}; {@link
 * com.manyorder.api.config.JwtFilter} (a {@code OncePerRequestFilter}) is
 * skipped on error dispatches, so no authentication is present, and while
 * {@code /error} was not permitted the request tripped the 401 entry point —
 * hiding the real 400/500 behind an empty 401.
 *
 * <p>These cases each returned an empty 401 before the fix. They run against a
 * real servlet container ({@code RANDOM_PORT}) because MockMvc does not perform
 * the error dispatch that is the whole point here.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ErrorHandlingIntegrationTest {

    @Value("${local.server.port}")
    int port;

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    private String token;
    private long storeId;
    private long productId;

    private HttpResponse<String> send(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json");
        if (token != null) b.header("Authorization", "Bearer " + token);
        b.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                                      : HttpRequest.BodyPublishers.ofString(body));
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String productPath() {
        return "/merchant/stores/" + storeId + "/products/" + productId;
    }

    @BeforeAll
    void setup() throws Exception {
        String email = "err-" + UUID.randomUUID() + "@test.com";
        HttpResponse<String> r = send("POST", "/auth/register", null, mapper.writeValueAsString(Map.of(
                "fullName", "Err Test", "email", email, "password", "password123", "role", "MERCHANT")));
        assertEquals(200, r.statusCode(), r.body());
        token = mapper.readTree(r.body()).get("token").asText();

        r = send("POST", "/merchant/stores", token, mapper.writeValueAsString(Map.of(
                "storeName", "Err Store", "slug", "err-store-" + UUID.randomUUID().toString().substring(0, 8))));
        assertEquals(201, r.statusCode(), r.body());
        storeId = mapper.readTree(r.body()).get("id").asLong();

        r = send("POST", "/merchant/stores/" + storeId + "/products", token, mapper.writeValueAsString(Map.of(
                "name", "Err Product", "price", 5.00, "stock", 3)));
        assertEquals(201, r.statusCode(), r.body());
        productId = mapper.readTree(r.body()).get("id").asLong();
    }

    /** Malformed JSON used to escape to the error dispatch and come back as an empty 401. */
    @Test
    void malformedJson_returns400WithBody_notEmpty401() throws Exception {
        HttpResponse<String> r = send("PATCH", productPath(), token, "{ not valid json");
        assertEquals(400, r.statusCode(), "malformed JSON must be 400, not a masked 401");
        assertFalse(r.body().isBlank(), "error response must carry a body, not an empty 401");
    }

    /** Oversized text now fails DTO validation as a clean 400 instead of overflowing the DB (which masked as 401). */
    @Test
    void oversizedName_returns400WithBody_notEmpty401() throws Exception {
        String body = mapper.writeValueAsString(Map.of("name", "N".repeat(256)));
        HttpResponse<String> r = send("PATCH", productPath(), token, body);
        assertEquals(400, r.statusCode(), "oversized name must fail validation as 400, not a masked 401");
        assertFalse(r.body().isBlank(), "error response must carry a body");
    }

    /** The original ask this bug blocked: long menu descriptions now persist (column is TEXT). */
    @Test
    void longDescription_isAcceptedAndRoundTrips() throws Exception {
        String desc = "D".repeat(600);
        HttpResponse<String> r = send("PATCH", productPath(), token, mapper.writeValueAsString(Map.of("description", desc)));
        assertEquals(200, r.statusCode(), "a 600-char description must be accepted now the column is TEXT");
        JsonNode patched = mapper.readTree(r.body());
        assertEquals(600, patched.get("description").asText().length(), "the full description must round-trip");
    }

    /** The safety net: /error is reachable on the (unauthenticated) error dispatch, so real errors surface. */
    @Test
    void errorEndpoint_isReachableWithoutAuth_notMaskedAs401() throws Exception {
        HttpResponse<String> r = send("GET", "/error", null, null);
        assertNotEquals(401, r.statusCode(), "/error must not trip the 401 entry point, else real errors stay masked");
    }
}
