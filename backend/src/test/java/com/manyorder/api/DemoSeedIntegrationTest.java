package com.manyorder.api;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies that {@link com.manyorder.api.config.DataSeeder} regenerates the FULL
 * demo state (three stores with their products, descriptions, photos, modifiers,
 * states and sample orders) on a fresh database — not just a minimal seed.
 *
 * <p>The seeder runs at context startup on the empty test database, so this
 * asserts the seeded result directly. Assertions are scoped to the seeded stores
 * (by slug) so they are unaffected by fixtures other tests add to the shared
 * context. {@code @Transactional} keeps the session open for lazy modifier
 * collections; the test only reads.
 */
@Transactional
class DemoSeedIntegrationTest extends IntegrationTestBase {

    @Autowired MerchantRepository merchantRepository;
    @Autowired ProductRepository productRepository;
    @Autowired OrderRepository orderRepository;

    private Merchant store(String slug) {
        return merchantRepository.findBySlug(slug).orElseThrow(
                () -> new AssertionError("store not seeded: " + slug));
    }

    private List<Product> products(String slug) {
        return productRepository.findByMerchantOrderByDisplayOrderAscIdAsc(store(slug));
    }

    private Product byName(String slug, String name) {
        return products(slug).stream().filter(p -> p.getName().equals(name)).findFirst()
                .orElseThrow(() -> new AssertionError("product not seeded: " + name + " in " + slug));
    }

    @Test
    void seedsAllThreeStores() {
        assertTrue(merchantRepository.findBySlug("kirikiri-brew").isPresent(), "Kiri Brew missing");
        assertTrue(merchantRepository.findBySlug("seoul-sakura").isPresent(), "Seoul & Sakura missing");
        assertTrue(merchantRepository.findBySlug("pixelforge").isPresent(), "PixelForge missing");
    }

    @Test
    void eachStoreHasEightProductsInDisplayOrder() {
        assertEquals(8, products("kirikiri-brew").size());
        assertEquals(8, products("seoul-sakura").size());
        assertEquals(8, products("pixelforge").size());
        assertEquals("Espresso", products("kirikiri-brew").get(0).getName());
        assertEquals("Tonkotsu Ramen", products("seoul-sakura").get(0).getName());
        assertEquals("Nomad Handheld Console", products("pixelforge").get(0).getName());
    }

    @Test
    void productsHavePhotosAndCorrectStates() {
        for (String slug : List.of("kirikiri-brew", "seoul-sakura", "pixelforge")) {
            for (Product p : products(slug)) {
                assertTrue(p.getPhotoUrl() != null
                        && p.getPhotoUrl().startsWith("https://res.cloudinary.com/tvdpnfdn/image/upload/"),
                        "missing/invalid photo on " + p.getName());
            }
        }
        // Sold-out is derived from stock == 0.
        assertEquals(0, byName("kirikiri-brew", "Cappuccino").getStock());
        assertEquals(0, byName("seoul-sakura", "Gyoza (6 pcs)").getStock());
        // Pre-order with an upcoming (relative) ready date.
        Product pumpkin = byName("kirikiri-brew", "Pumpkin Spice Loaf");
        assertTrue(pumpkin.isPreOrder(), "Pumpkin should be pre-order");
        assertTrue(pumpkin.getPreOrderReadyDate().isAfter(LocalDate.now().minusDays(1)),
                "pre-order ready date should be upcoming, not stale");
    }

    @Test
    void modifiersAreSeeded() {
        // Bibimbap: Spice level + Protein + Add-ons
        Product bibimbap = byName("seoul-sakura", "Bibimbap");
        assertEquals(List.of("Spice level", "Protein", "Add-ons"),
                bibimbap.getModifierGroups().stream().map(g -> g.getName()).toList());
        assertEquals(3, bibimbap.getModifierGroups().get(1).getOptions().size(), "Protein has 3 options");
        // Iced Latte: Milk + Size + Extras
        assertEquals(List.of("Milk", "Size", "Extras"),
                byName("kirikiri-brew", "Iced Latte").getModifierGroups().stream().map(g -> g.getName()).toList());
        // A plain product has none.
        assertTrue(byName("seoul-sakura", "Kimchi").getModifierGroups().isEmpty());
    }

    @Test
    void sampleOrdersSeededPerStore() {
        assertEquals(3, orderRepository.findByMerchantOrderByCreatedAtDesc(store("kirikiri-brew")).size());
        assertEquals(2, orderRepository.findByMerchantOrderByCreatedAtDesc(store("seoul-sakura")).size());
        assertEquals(2, orderRepository.findByMerchantOrderByCreatedAtDesc(store("pixelforge")).size());
    }
}
