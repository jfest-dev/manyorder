package com.manyorder.api.domain.storefront;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.merchant.SlugService;

/**
 * Public, read-only store-slug availability. Side-effect free and rate limited as a
 * public endpoint. It uses the SAME normalization as create/rename and returns the
 * SAME neutral answer ({@code available:false}) for taken, reserved and invalid
 * names, so it never reveals which stores exist or which names are reserved.
 */
@RestController
@RequestMapping("/public")
public class SlugAvailabilityController {

    private final SlugService slugService;

    public SlugAvailabilityController(SlugService slugService) {
        this.slugService = slugService;
    }

    @GetMapping("/store-slug-available")
    public SlugAvailabilityResponse check(@RequestParam(name = "slug", required = false) String slug) {
        return new SlugAvailabilityResponse(slugService.isAvailable(slug));
    }

    public record SlugAvailabilityResponse(boolean available) {}
}
