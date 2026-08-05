package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.upload.CloudinaryImageService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Product photo wiring with the image host mocked: the happy-path upload echoes
 * the hosted URL, and replacing/removing a product's photo deletes the old file.
 */
class ProductPhotoWiringIntegrationTest extends IntegrationTestBase {

    @MockitoBean private CloudinaryImageService imageService;

    private static final byte[] PNG_MAGIC =
            {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    private static final String URL_A = "https://res.cloudinary.com/x/image/upload/v1/manyorder/1/9/products/1/a.png";
    private static final String URL_B = "https://res.cloudinary.com/x/image/upload/v2/manyorder/1/9/products/1/b.png";

    private long setup(String email, String slug) throws Exception {
        String token = registerAndGetToken(email, "MERCHANT", null);
        this.token = token;
        this.storeId = createStore(token, "Photo Wiring", slug);
        MvcResult r = mockMvc.perform(post("/merchant/stores/" + storeId + "/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"P\",\"price\":1.00}"))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r).get("id").asLong();
    }

    private String token;
    private long storeId;

    private void patchPhoto(long productId, String logoUrlJson) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId + "/products/" + productId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"photoUrl\":" + logoUrlJson + "}"))
                .andExpect(status().isOk());
    }

    @Test
    void validImage_uploadsToProductFolder_andReturnsUrl() throws Exception {
        long id = setup("prod-photo-ok@test.com", "photo-ok");
        when(imageService.uploadProductPhoto(any(), anyLong(), anyLong(), anyLong())).thenReturn(URL_A);

        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", PNG_MAGIC);
        mockMvc.perform(multipart("/merchant/stores/" + storeId + "/products/" + id + "/photo")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(URL_A));
    }

    @Test
    void photo_deletedOnReplaceAndRemove_notOnFirstSet() throws Exception {
        long id = setup("prod-photo-del@test.com", "photo-del");

        // First set (no prior photo) -> nothing deleted.
        patchPhoto(id, "\"" + URL_A + "\"");
        verify(imageService, never()).deleteByUrl(any());

        // Replace A -> B -> old A deleted.
        patchPhoto(id, "\"" + URL_B + "\"");
        verify(imageService, times(1)).deleteByUrl(eq(URL_A));

        // Remove (empty string) -> current B deleted.
        patchPhoto(id, "\"\"");
        verify(imageService, times(1)).deleteByUrl(eq(URL_B));
    }
}
