package com.manyorder.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Account tab backend: the signed-in user updates only their own name and phone. */
class AccountProfileIntegrationTest extends IntegrationTestBase {

    private org.springframework.test.web.servlet.ResultActions putAccount(String token, String body) throws Exception {
        return mockMvc.perform(put("/account").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void updatesOwnNameAndPhone_andClearsPhoneWhenEmpty() throws Exception {
        String token = registerAndGetToken("acct-a@test.com", "MERCHANT", null);

        JsonNode updated = json(putAccount(token, "{\"fullName\":\"  Mei Tan  \",\"phone\":\"+65 9123 4567\"}")
                .andExpect(status().isOk()).andReturn());
        assertEquals("Mei Tan", updated.get("fullName").asText(), "name is trimmed");
        assertEquals("+65 9123 4567", updated.get("phone").asText());

        // Phone is optional: an empty phone clears it to null.
        JsonNode cleared = json(putAccount(token, "{\"fullName\":\"Mei Tan\",\"phone\":\"\"}")
                .andExpect(status().isOk()).andReturn());
        assertTrue(cleared.get("phone").isNull(), "empty phone clears to null");

        // GET reflects the saved state.
        JsonNode me = json(getWithToken("/account", token, 200));
        assertEquals("Mei Tan", me.get("fullName").asText());
        assertTrue(me.get("phone").isNull());
    }

    @Test
    void blankName_isRejected() throws Exception {
        String token = registerAndGetToken("acct-b@test.com", "MERCHANT", null);
        putAccount(token, "{\"fullName\":\"   \"}").andExpect(status().isBadRequest());
    }

    @Test
    void tooLongName_isRejected() throws Exception {
        String token = registerAndGetToken("acct-c@test.com", "MERCHANT", null);
        String longName = "x".repeat(101);
        putAccount(token, "{\"fullName\":\"" + longName + "\"}").andExpect(status().isBadRequest());
    }

    @Test
    void cannotChangeEmailRoleOrVerified() throws Exception {
        String token = registerAndGetToken("acct-d@test.com", "MERCHANT", null);

        // Extra fields are ignored: only name/phone are bound.
        putAccount(token, "{\"fullName\":\"New Name\",\"phone\":\"123\","
                + "\"email\":\"hacker@evil.com\",\"role\":\"PLATFORM_ADMIN\",\"verified\":true}")
                .andExpect(status().isOk());

        JsonNode me = json(getWithToken("/account", token, 200));
        assertEquals("acct-d@test.com", me.get("email").asText(), "email unchanged");
        assertEquals("MERCHANT", me.get("role").asText(), "role unchanged");
        assertEquals(false, me.get("verified").asBoolean(), "verified unchanged");
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(put("/account").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Nobody\"}")).andExpect(status().isUnauthorized());
    }
}
