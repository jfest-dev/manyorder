package com.manyorder.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Client-key derivation for the rate limiter: X-Real-IP, then the leftmost
 * X-Forwarded-For, then the socket address, with malformed values ignored.
 */
class RateLimitClientKeyTest {

    private static MockHttpServletRequest req(String realIp, String xff, String remoteAddr) {
        MockHttpServletRequest r = new MockHttpServletRequest();
        if (realIp != null) r.addHeader("X-Real-IP", realIp);
        if (xff != null) r.addHeader("X-Forwarded-For", xff);
        r.setRemoteAddr(remoteAddr);
        return r;
    }

    @Test
    void xRealIp_winsOverXffAndSocket() {
        assertEquals("1.2.3.4", RateLimitFilter.clientKey(req("1.2.3.4", "5.6.7.8", "9.9.9.9")));
    }

    @Test
    void leftmostXff_whenNoRealIp() {
        // The client is the first entry; later entries are proxy hops.
        assertEquals("5.6.7.8", RateLimitFilter.clientKey(req(null, "5.6.7.8, 9.9.9.9, 10.0.0.1", "127.0.0.1")));
    }

    @Test
    void malformedRealIp_fallsThroughToXff() {
        assertEquals("5.6.7.8", RateLimitFilter.clientKey(req("not-an-ip", "5.6.7.8", "127.0.0.1")));
    }

    @Test
    void malformedLeftmostXff_fallsThroughToSocket() {
        // The leftmost entry is garbage, so X-Forwarded-For is unusable and we use
        // the socket address rather than trusting a later entry.
        assertEquals("10.0.0.1", RateLimitFilter.clientKey(req(null, "garbage, 5.6.7.8", "10.0.0.1")));
    }

    @Test
    void noHeaders_usesSocketAddress() {
        assertEquals("127.0.0.1", RateLimitFilter.clientKey(req(null, null, "127.0.0.1")));
    }

    @Test
    void blankHeaders_useSocketAddress() {
        assertEquals("127.0.0.1", RateLimitFilter.clientKey(req("   ", "   ", "127.0.0.1")));
    }

    @Test
    void ipv6_isAcceptedInBothHeaders() {
        assertEquals("2001:db8::1", RateLimitFilter.clientKey(req("2001:db8::1", null, "127.0.0.1")));
        assertEquals("2001:db8::2", RateLimitFilter.clientKey(req(null, "2001:db8::2, 9.9.9.9", "127.0.0.1")));
    }

    @Test
    void emptyRemoteAddr_withNoValidHeader_isUnknown() {
        assertEquals("unknown", RateLimitFilter.clientKey(req("bad", "also-bad", "")));
    }

    @Test
    void isValidIp_acceptsWellFormedAddresses() {
        assertTrue(RateLimitFilter.isValidIp("0.0.0.0"));
        assertTrue(RateLimitFilter.isValidIp("255.255.255.255"));
        assertTrue(RateLimitFilter.isValidIp("203.0.113.5"));
        assertTrue(RateLimitFilter.isValidIp("::1"));
        assertTrue(RateLimitFilter.isValidIp("2001:db8::ff00:42:8329"));
        assertTrue(RateLimitFilter.isValidIp("fe80::1%eth0")); // zone id tolerated
    }

    @Test
    void isValidIp_rejectsMalformedValues() {
        assertFalse(RateLimitFilter.isValidIp(null));
        assertFalse(RateLimitFilter.isValidIp(""));
        assertFalse(RateLimitFilter.isValidIp("256.1.1.1"));
        assertFalse(RateLimitFilter.isValidIp("1.2.3"));
        assertFalse(RateLimitFilter.isValidIp("a.b.c.d"));
        assertFalse(RateLimitFilter.isValidIp("1.2.3.4.5"));
        assertFalse(RateLimitFilter.isValidIp("hello"));
        assertFalse(RateLimitFilter.isValidIp("12345"));
        assertFalse(RateLimitFilter.isValidIp("gggg::1"));
    }
}
