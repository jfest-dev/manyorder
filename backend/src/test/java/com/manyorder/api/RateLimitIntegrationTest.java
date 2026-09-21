package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Per-IP rate limiting on public endpoints. Small tier limits are set here so the
 * behaviour is independent of the production tuning: STRICT 2/min, STANDARD 3/min,
 * READS 10/min, GLOBAL 5/min. Each test uses a distinct client IP so buckets don't
 * bleed across tests.
 */
@TestPropertySource(properties = {
        "app.ratelimit.enabled=true",
        "app.ratelimit.strict-per-minute=2",
        "app.ratelimit.standard-per-minute=3",
        "app.ratelimit.reads-per-minute=10",
        "app.ratelimit.global-per-minute=5",
})
class RateLimitIntegrationTest extends IntegrationTestBase {

    private static final int TOO_MANY = 429;

    /** Pin a client IP on the request (what getRemoteAddr() returns). */
    private RequestPostProcessor ip(String addr) {
        return request -> { request.setRemoteAddr(addr); return request; };
    }

    private int postValidate(String ip) throws Exception {
        return mockMvc.perform(post("/public/discounts/validate").with(ip(ip))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"merchantId\":1,\"code\":\"NOPE\",\"items\":[]}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void standardEndpoint_blocksOverTheLimit_withRetryAfter() throws Exception {
        String ip = "10.0.0.1";
        // STANDARD = 3/min: first three pass the limiter (whatever the controller
        // returns), the fourth is rejected before it reaches the controller.
        for (int i = 0; i < 3; i++) assertNotEquals(TOO_MANY, postValidate(ip), "request " + (i + 1) + " within limit");

        var blocked = mockMvc.perform(post("/public/discounts/validate").with(ip(ip))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"merchantId\":1,\"code\":\"NOPE\",\"items\":[]}"))
                .andReturn().getResponse();
        assertEquals(TOO_MANY, blocked.getStatus(), "4th request is rate limited");
        assertNotNull(blocked.getHeader("Retry-After"), "429 carries a Retry-After header");
    }

    @Test
    void strictEndpoint_blocksSooner() throws Exception {
        String ip = "10.0.0.2";
        // STRICT = 2/min (forgot-password sends an email).
        for (int i = 0; i < 2; i++) {
            int s = mockMvc.perform(post("/auth/forgot-password").with(ip(ip))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"a@b.com\"}"))
                    .andReturn().getResponse().getStatus();
            assertNotEquals(TOO_MANY, s, "request " + (i + 1) + " within strict limit");
        }
        int blocked = mockMvc.perform(post("/auth/forgot-password").with(ip(ip))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"a@b.com\"}"))
                .andReturn().getResponse().getStatus();
        assertEquals(TOO_MANY, blocked, "3rd strict request is rate limited");
    }

    @Test
    void globalBackstop_blocksAcrossEndpoints_belowAnyTierLimit() throws Exception {
        String ip = "10.0.0.3";
        // Reads tier is 10 but the GLOBAL backstop is 5: five public GETs pass, the
        // sixth trips the global limit even though the reads tier isn't exhausted.
        for (int i = 0; i < 5; i++) {
            int s = mockMvc.perform(get("/public/stores/no-such-store").with(ip(ip)))
                    .andReturn().getResponse().getStatus();
            assertNotEquals(TOO_MANY, s, "read " + (i + 1) + " within global");
        }
        int blocked = mockMvc.perform(get("/public/stores/no-such-store").with(ip(ip)))
                .andReturn().getResponse().getStatus();
        assertEquals(TOO_MANY, blocked, "6th request trips the global backstop");
    }

    @Test
    void limitsArePerIp_soOneClientDoesNotBlockAnother() throws Exception {
        // Exhaust the standard limit on IP a; IP b is unaffected.
        for (int i = 0; i < 3; i++) postValidate("10.0.1.1");
        assertEquals(TOO_MANY, postValidate("10.0.1.1"), "IP a is now blocked");
        assertNotEquals(TOO_MANY, postValidate("10.0.1.2"), "a different IP is independent");
    }
}
