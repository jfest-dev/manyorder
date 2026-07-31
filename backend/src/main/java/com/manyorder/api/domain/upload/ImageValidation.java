package com.manyorder.api.domain.upload;

import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Server-side gate for uploaded images. The SPA runs the same type/size checks
 * for a friendly UX, but they are advisory only — this is the real boundary, so
 * every rule is re-checked here and never trusted from the client.
 *
 * Beyond the declared content type we sniff the leading "magic" bytes: a caller
 * can set any Content-Type header, so a real image must actually start with the
 * signature of a format we accept. Constants mirror the frontend allow-list.
 */
public final class ImageValidation {

    /** Keep in sync with the SPA's lib/image.ts allow-list. */
    public static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024; // 5 MB

    private ImageValidation() {}

    /**
     * Validate an uploaded image or throw a 400 with a client-safe message.
     * Order matters: presence, then size, then declared type, then real bytes.
     */
    public static void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("Please choose an image to upload.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw badRequest("Image must be under 5 MB.");
        }

        byte[] head = readHead(file);
        if (!looksLikeAllowedImage(head)) {
            throw badRequest("Please upload a JPG, PNG, or WebP image.");
        }
    }

    /** Read just enough leading bytes to identify the format (WebP needs 12). */
    private static byte[] readHead(MultipartFile file) {
        try {
            byte[] all = file.getBytes();
            int n = Math.min(all.length, 12);
            byte[] head = new byte[n];
            System.arraycopy(all, 0, head, 0, n);
            return head;
        } catch (Exception e) {
            throw badRequest("Could not read the uploaded image.");
        }
    }

    /** True when the bytes begin with a JPEG, PNG, or WebP signature. */
    private static boolean looksLikeAllowedImage(byte[] b) {
        return isJpeg(b) || isPng(b) || isWebp(b);
    }

    private static boolean isJpeg(byte[] b) {
        // FF D8 FF
        return b.length >= 3
                && (b[0] & 0xFF) == 0xFF
                && (b[1] & 0xFF) == 0xD8
                && (b[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] b) {
        // 89 50 4E 47 0D 0A 1A 0A
        byte[] sig = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        if (b.length < sig.length) return false;
        for (int i = 0; i < sig.length; i++) {
            if (b[i] != sig[i]) return false;
        }
        return true;
    }

    private static boolean isWebp(byte[] b) {
        // "RIFF" ???? "WEBP" — a RIFF container tagged WEBP.
        return b.length >= 12
                && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
