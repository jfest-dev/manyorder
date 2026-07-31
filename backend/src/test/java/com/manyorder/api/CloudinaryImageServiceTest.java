package com.manyorder.api;

import org.junit.jupiter.api.Test;

import com.manyorder.api.domain.upload.CloudinaryImageService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Pure parsing tests for recovering a Cloudinary public_id from a delivery URL. */
class CloudinaryImageServiceTest {

    @Test
    void extractsPublicId_fromOurLogoUrl_withVersion() {
        String url = "https://res.cloudinary.com/tvdpnfdn/image/upload/v1785505312/manyorder/8/logo/kvptmht8mpl6yez1imxb.png";
        assertEquals("manyorder/8/logo/kvptmht8mpl6yez1imxb", CloudinaryImageService.extractPublicId(url));
    }

    @Test
    void extractsPublicId_withoutVersionSegment() {
        String url = "https://res.cloudinary.com/tvdpnfdn/image/upload/manyorder/8/logo/abc.jpg";
        assertEquals("manyorder/8/logo/abc", CloudinaryImageService.extractPublicId(url));
    }

    @Test
    void handlesNestedFoldersAndKeepsPathButDropsExtension() {
        String url = "https://res.cloudinary.com/x/image/upload/v1/manyorder/42/9/products/128/photo.webp";
        assertEquals("manyorder/42/9/products/128/photo", CloudinaryImageService.extractPublicId(url));
    }

    @Test
    void returnsNull_forNonCloudinaryUrl() {
        assertNull(CloudinaryImageService.extractPublicId("https://example.com/whatever/x.png"));
    }

    @Test
    void returnsNull_forBlankOrNull() {
        assertNull(CloudinaryImageService.extractPublicId(null));
        assertNull(CloudinaryImageService.extractPublicId("   "));
    }
}
