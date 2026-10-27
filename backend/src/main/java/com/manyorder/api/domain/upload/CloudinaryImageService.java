package com.manyorder.api.domain.upload;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

/**
 * Uploads image bytes to the image host and returns the hosted URL. The host is
 * an implementation detail — nothing about it leaks into API responses or
 * user-facing copy; callers just get back an absolute https URL.
 *
 * Credentials come from the CLOUDINARY_* env vars via config. When any is
 * missing (tests, local dev without a key) the service reports itself disabled
 * and the endpoint answers 503, rather than attempting a doomed upload.
 *
 * <h2>Folder convention (decide once, follow everywhere)</h2>
 * Everything for one owner lives under a single prefix, so all of an owner's
 * assets can be listed or purged in one place. {@code {rootFolder}} is
 * configurable (default {@code manyorder}); the rest is fixed:
 * <pre>
 *   {rootFolder}/{userId}/logo/...                            owner-level logo
 *   {rootFolder}/{userId}/{storeId}/products/{productId}/...  store-scoped product photos (later)
 * </pre>
 * The logo is owner-level (not store-scoped) because it is uploaded during
 * onboarding, before any store exists — so no {@code storeId} is available yet.
 * Product uploads, added later, are store-scoped and slot in beside it under the
 * same {@code {userId}} prefix. When Products lands, add an {@code uploadProduct}
 * method here that builds {@code {rootFolder}/{userId}/{storeId}/products/{productId}}
 * rather than re-deciding the layout.
 */
@Service
public class CloudinaryImageService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryImageService.class);

    private final Cloudinary cloudinary; // null when unconfigured
    private final String rootFolder;

    public CloudinaryImageService(
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            @Value("${app.cloudinary.api-key:}") String apiKey,
            @Value("${app.cloudinary.api-secret:}") String apiSecret,
            @Value("${app.cloudinary.root-folder:manyorder}") String rootFolder) {
        this.rootFolder = rootFolder;
        if (isBlank(cloudName) || isBlank(apiKey) || isBlank(apiSecret)) {
            this.cloudinary = null;
            log.info("Image host not configured — logo uploads are disabled (endpoint returns 503).");
        } else {
            this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName.trim(),
                    "api_key", apiKey.trim(),
                    "api_secret", apiSecret.trim(),
                    "secure", true));
        }
    }

    public boolean isEnabled() {
        return cloudinary != null;
    }

    /**
     * Upload an already-validated store logo and return the hosted secure URL.
     * Stored owner-level at {@code {rootFolder}/{userId}/logo} per the folder
     * convention above. Throws 503 if the host is not configured, 502 if the
     * upload itself fails.
     *
     * @param merchantId the owning account's user id (the logo is not store-scoped)
     */
    public String uploadLogo(byte[] imageBytes, long merchantId) {
        return uploadToFolder(imageBytes, rootFolder + "/" + merchantId + "/logo");
    }

    /**
     * Upload an already-validated product photo and return the hosted secure URL.
     * Stored store-scoped at
     * {@code {rootFolder}/{userId}/{storeId}/products/{productId}} per the folder
     * convention above. Throws 503 if the host is not configured, 502 on failure.
     */
    public String uploadProductPhoto(byte[] imageBytes, long merchantId, long storeId, long productId) {
        return uploadToFolder(imageBytes,
                rootFolder + "/" + merchantId + "/" + storeId + "/products/" + productId);
    }

    private String uploadToFolder(byte[] imageBytes, String folder) {
        if (cloudinary == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Image uploads are not available right now.");
        }
        try {
            Map<?, ?> result = cloudinary.uploader().upload(imageBytes, ObjectUtils.asMap(
                    "folder", folder,
                    "resource_type", "image"));
            String url = (String) result.get("secure_url");
            if (isBlank(url)) {
                throw new IllegalStateException("Upload response had no secure_url");
            }
            return url;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Image upload to host failed (folder {})", folder, e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not upload the image. Please try again.");
        }
    }

    /**
     * Best-effort delete of a previously uploaded asset, given the secure URL we
     * stored. Used when a logo is removed or replaced so the old file does not
     * linger orphaned. Never throws: a failed cleanup must not fail the user's
     * save, and a URL that isn't one of ours (unparseable, or outside our root
     * folder) is simply ignored.
     */
    public void deleteByUrl(String url) {
        if (cloudinary == null || isBlank(url)) {
            return;
        }
        String publicId = extractPublicId(url);
        // Only touch assets under our own root prefix — never delete arbitrary ids.
        if (publicId == null || !publicId.startsWith(rootFolder + "/")) {
            return;
        }
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("invalidate", true));
        } catch (Exception e) {
            log.warn("Failed to delete old logo '{}' from image host — leaving it orphaned", publicId, e);
        }
    }

    /**
     * Recover the Cloudinary public_id (folder path + name, no extension) from a
     * delivery URL such as
     * {@code https://res.cloudinary.com/<cloud>/image/upload/v123/manyorder/8/logo/abc.png}
     * → {@code manyorder/8/logo/abc}. Returns null if the URL isn't a Cloudinary
     * upload URL. Handles our own URLs (optional {@code v<version>} segment, no
     * transformations).
     */
    public static String extractPublicId(String url) {
        if (isBlank(url)) {
            return null;
        }
        int idx = url.indexOf("/upload/");
        if (idx < 0) {
            return null;
        }
        String rest = url.substring(idx + "/upload/".length()).split("[?#]")[0];
        String[] segments = rest.split("/");
        int start = 0;
        // Drop a leading version segment (v1234567890) if present.
        if (segments.length > 0 && segments[0].matches("v\\d+")) {
            start = 1;
        }
        String joined = String.join("/", java.util.Arrays.copyOfRange(segments, start, segments.length));
        int dot = joined.lastIndexOf('.');
        if (dot > joined.lastIndexOf('/')) {
            joined = joined.substring(0, dot); // strip file extension
        }
        return joined.isBlank() ? null : joined;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
