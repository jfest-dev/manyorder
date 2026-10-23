package com.manyorder.api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Two simultaneous creates of the same slug end with exactly one 201 and one 409,
 * never a 500. The unique constraint on merchants.slug is the backstop, and the
 * resulting DataIntegrityViolationException is mapped to 409 by the global handler.
 */
class SlugRaceIntegrationTest extends IntegrationTestBase {

    private int createStatus(String token, String slug) throws Exception {
        return mockMvc.perform(post("/merchant/stores")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("storeName", "Race " + slug, "slug", slug))))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void twoSimultaneousCreates_sameSlug_giveOne201AndOne409() throws Exception {
        String nonce = Long.toString(System.nanoTime());
        String tokenA = registerAndGetToken("race-a-" + nonce + "@test.com", "MERCHANT", null);
        String tokenB = registerAndGetToken("race-b-" + nonce + "@test.com", "MERCHANT", null);
        String slug = "race-slug-" + nonce;

        // Line both threads up on the barrier so the two inserts race.
        CyclicBarrier barrier = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> fa = pool.submit(() -> { barrier.await(); return createStatus(tokenA, slug); });
            Future<Integer> fb = pool.submit(() -> { barrier.await(); return createStatus(tokenB, slug); });
            List<Integer> statuses = List.of(fa.get(), fb.get()).stream().sorted().toList();

            assertTrue(statuses.stream().noneMatch(s -> s >= 500), "no 5xx: " + statuses);
            assertEquals(List.of(201, 409), statuses,
                    "exactly one create succeeds and one conflicts: " + statuses);
        } finally {
            pool.shutdownNow();
        }
    }
}
