package com.manyorder.api;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import com.manyorder.api.domain.upload.CloudinaryImageService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Happy-path wiring for the logo upload endpoint with the image host mocked, so
 * a valid file passes validation, reaches the host, and the returned URL is
 * echoed back — without any real network call or credentials. Also proves the
 * controller keys the upload to the authenticated owner (userId), matching the
 * owner-level folder convention.
 */
class LogoUploadWiringIntegrationTest extends IntegrationTestBase {

    @MockitoBean private CloudinaryImageService imageService;

    // A real PNG signature so ImageValidation accepts the bytes.
    private static final byte[] PNG_MAGIC =
            {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    @Test
    void validImage_uploadsForOwner_andReturnsHostedUrl() throws Exception {
        // Register directly so we know the owner's userId (which the folder is keyed on).
        MvcResult reg = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Logo Owner",
                                "email", "logo-ok@test.com",
                                "password", "password123",
                                "role", "MERCHANT"))))
                .andExpect(status().isOk())
                .andReturn();
        long userId = json(reg).get("userId").asLong();
        String token = json(reg).get("token").asText();

        String hostedUrl = "https://res.cloudinary.com/demo/image/upload/manyorder/1/logo/x.png";
        when(imageService.uploadLogo(any(), anyLong())).thenReturn(hostedUrl);

        MockMultipartFile file = new MockMultipartFile("file", "logo.png", "image/png", PNG_MAGIC);

        mockMvc.perform(multipart("/merchant/uploads/logo").file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(hostedUrl));

        // The upload is keyed to the authenticated owner's id.
        ArgumentCaptor<Long> idCaptor = ArgumentCaptor.forClass(Long.class);
        verify(imageService).uploadLogo(any(), idCaptor.capture());
        assertEquals(userId, idCaptor.getValue());

        // Guard against accidentally passing any other id.
        verify(imageService).uploadLogo(any(), eq(userId));
    }
}
