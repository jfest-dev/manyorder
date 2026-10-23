package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The public API docs (Swagger UI + /v3/api-docs) are gated on app.docs.enabled.
 * Off by default (production): the springdoc endpoints are not registered, so the
 * paths return 404 and never leak that they exist. On when enabled (local/dev).
 * Turn them back on with APP_DOCS_ENABLED=true (app.docs.enabled).
 */
class ApiDocsToggleTest {

    @SpringBootTest
    @AutoConfigureMockMvc
    static class Disabled {
        @Autowired MockMvc mockMvc;

        @Test
        void apiDocsAreOffByDefault() throws Exception {
            // No springdoc handler registered -> 404 for the permitAll paths, and 401
            // for the secured .yaml path. Either way: a 4xx, never a 200, no leak.
            mockMvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
            mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
            mockMvc.perform(get("/v3/api-docs.yaml")).andExpect(status().is4xxClientError());
        }
    }

    @SpringBootTest(properties = "app.docs.enabled=true")
    @AutoConfigureMockMvc
    static class Enabled {
        @Autowired MockMvc mockMvc;

        @Test
        void apiDocsAreServedWhenEnabled() throws Exception {
            mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
            mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        }
    }
}
