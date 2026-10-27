package com.manyorder.api.domain.upload;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;
import com.manyorder.api.security.CurrentUserService;

/**
 * Generic logo upload, not scoped to a store: during onboarding the store does
 * not exist yet, so both Create Store and Settings post the raw file here first
 * and then persist the returned URL via the normal create/update store call.
 *
 * Owner-only. The file is validated server-side (type, size, real image bytes)
 * before it ever reaches the image host.
 */
@RestController
@RequestMapping("/merchant/uploads")
public class UploadController {

    private final CurrentUserService currentUserService;
    private final CloudinaryImageService imageService;

    public UploadController(CurrentUserService currentUserService,
                            CloudinaryImageService imageService) {
        this.currentUserService = currentUserService;
        this.imageService = imageService;
    }

    @PostMapping("/logo")
    public LogoUploadResponse uploadLogo(@RequestParam("file") MultipartFile file,
                                         Authentication authentication) {
        User user = requireMerchant(authentication);
        ImageValidation.validate(file);
        // Owner-level folder: no store exists yet during onboarding (see
        // CloudinaryImageService for the full folder convention).
        String url = imageService.uploadLogo(readBytes(file), user.getId());
        return new LogoUploadResponse(url);
    }

    /**
     * A file larger than the multipart ceiling never binds to the handler, so
     * translate that container-level failure into the same clean message the
     * size validator uses.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorBody tooLarge(MaxUploadSizeExceededException e) {
        return new ErrorBody("Image must be under 5 MB.");
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Could not read the uploaded image.");
        }
    }

    /** Logos are set by store owners; staff accounts cannot upload. */
    private User requireMerchant(Authentication authentication) {
        User user = currentUserService.require(authentication);
        if (user.getRole() != UserRole.MERCHANT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Merchant role required");
        }
        return user;
    }

    /** Minimal error shape so the size-limit handler returns a JSON message. */
    public record ErrorBody(String message) {}
}
