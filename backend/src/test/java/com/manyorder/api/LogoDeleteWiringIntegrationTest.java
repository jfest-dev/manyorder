package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.manyorder.api.domain.upload.CloudinaryImageService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves the store-update path deletes a logo's old file from the image host
 * when the logo is replaced or removed — and only then. The host is mocked, so
 * we assert the controller calls deleteByUrl with the right (old) URL; the
 * URL→public_id parsing is covered in {@link CloudinaryImageServiceTest}.
 */
class LogoDeleteWiringIntegrationTest extends IntegrationTestBase {

    @MockitoBean private CloudinaryImageService imageService;

    private static final String URL_A = "https://res.cloudinary.com/x/image/upload/v1/manyorder/1/logo/a.png";
    private static final String URL_B = "https://res.cloudinary.com/x/image/upload/v2/manyorder/1/logo/b.png";

    private void patchLogo(String token, long storeId, String logoUrlJson) throws Exception {
        mockMvc.perform(patch("/merchant/stores/" + storeId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"logoUrl\":" + logoUrlJson + "}"))
                .andExpect(status().isOk());
    }

    @Test
    void deletesOldLogo_onReplaceAndRemove_butNotOnFirstSetOrNoop() throws Exception {
        String token = registerAndGetToken("logo-del@test.com", "MERCHANT", null);
        long storeId = createStore(token, "Del Store", "del-store");

        // First set (no prior logo) -> nothing to delete.
        patchLogo(token, storeId, "\"" + URL_A + "\"");
        verify(imageService, never()).deleteByUrl(any());

        // Replace A -> B -> the old A is deleted.
        patchLogo(token, storeId, "\"" + URL_B + "\"");
        verify(imageService, times(1)).deleteByUrl(eq(URL_A));

        // Re-sending the same URL is a no-op -> B must not be deleted.
        patchLogo(token, storeId, "\"" + URL_B + "\"");
        verify(imageService, never()).deleteByUrl(eq(URL_B));

        // Remove (empty string) -> the current B is deleted.
        patchLogo(token, storeId, "\"\"");
        verify(imageService, times(1)).deleteByUrl(eq(URL_B));

        // A was deleted exactly once across the whole flow.
        verify(imageService, times(1)).deleteByUrl(eq(URL_A));
    }
}
