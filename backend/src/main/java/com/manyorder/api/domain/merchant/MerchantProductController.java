package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.product.CreateProductRequest;
import com.manyorder.api.domain.product.ProductPhotoResponse;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.domain.product.ReorderProductsRequest;
import com.manyorder.api.domain.product.UpdateProductRequest;
import com.manyorder.api.domain.upload.CloudinaryImageService;
import com.manyorder.api.domain.upload.ImageValidation;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Staff may view products; only the owner may create, edit, or deactivate them. */
@RestController
@RequestMapping("/merchant/stores/{storeId}/products")
public class MerchantProductController {

    private final ProductService productService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final CloudinaryImageService imageService;

    public MerchantProductController(ProductService productService,
                                     CurrentUserService currentUserService,
                                     StoreAccessService storeAccessService,
                                     CloudinaryImageService imageService) {
        this.productService = productService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.imageService = imageService;
    }

    @GetMapping
    public List<ProductResponse> getProducts(
            @PathVariable Long storeId,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly,
            Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);

        return activeOnly
                ? productService.getActiveProducts(merchant)
                : productService.getProducts(merchant);
    }

    /** Single product (owner or assigned staff may read) — used to load Edit Product. */
    @GetMapping("/{productId}")
    public ProductResponse getProduct(@PathVariable Long storeId,
                                      @PathVariable Long productId,
                                      Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return productService.getProduct(merchant, productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createProduct(@PathVariable Long storeId,
                                         @Valid @RequestBody CreateProductRequest request,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.createProduct(merchant, request);
    }

    @PatchMapping("/reorder")
    public List<ProductResponse> reorderProducts(@PathVariable Long storeId,
                                                 @Valid @RequestBody ReorderProductsRequest request,
                                                 Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.reorderProducts(merchant, request.getProductIds());
    }

    @PatchMapping("/{productId}")
    public ProductResponse updateProduct(@PathVariable Long storeId,
                                         @PathVariable Long productId,
                                         @Valid @RequestBody UpdateProductRequest request,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.updateProduct(merchant, productId, request);
    }

    @PatchMapping("/{productId}/deactivate")
    public ProductResponse deactivateProduct(@PathVariable Long storeId,
                                             @PathVariable Long productId,
                                             Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.deactivateProduct(merchant, productId);
    }

    /** Permanently delete a product (owner only). Order history is preserved via
     *  the name/price snapshot on each order line. */
    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@PathVariable Long storeId,
                              @PathVariable Long productId,
                              Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        productService.deleteProduct(merchant, productId);
    }

    /**
     * Upload a photo for an existing product (owner only). Multipart; validated
     * server-side (type/size/real bytes) and stored under the product's folder
     * (manyorder/{userId}/{storeId}/products/{productId}). Returns the hosted URL;
     * the client then PATCHes it onto the product via photoUrl (delete-on-replace
     * handled there, mirroring the store logo).
     */
    @PostMapping("/{productId}/photo")
    public ProductPhotoResponse uploadPhoto(@PathVariable Long storeId,
                                            @PathVariable Long productId,
                                            @RequestParam("file") MultipartFile file,
                                            Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        productService.requireOwnedProduct(merchant, productId); // 404 if not this store's product
        ImageValidation.validate(file);
        String url = imageService.uploadProductPhoto(readBytes(file), user.getId(), storeId, productId);
        return new ProductPhotoResponse(url);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorBody tooLarge(MaxUploadSizeExceededException e) {
        return new ErrorBody("Image must be under 5 MB.");
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read the uploaded image.");
        }
    }

    /** Minimal error shape for the size-limit handler. */
    public record ErrorBody(String message) {}
}
