package com.manyorder.api.domain.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes an {@link AdminAuditLog} entry for every successful admin mutation under
 * {@code /admin/**}. Running in {@code afterCompletion} means it sees the final
 * status and only records when the action actually succeeded (status under 400);
 * a failed or rejected request leaves no misleading row.
 *
 * <p>Centralising it here is what makes auditing impossible to miss: a new admin
 * mutation endpoint is covered the moment it is registered, and a guard test fails
 * the build if the {@link AdminAuditClassifier} does not recognise its route.
 * Merchant suspend/unsuspend are audited inline by their controller and are not
 * recognised here, so they are not double-logged.
 */
@Component
public class AdminAuditInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditInterceptor.class);

    private final AdminAuditClassifier classifier;
    private final AdminAuditService auditService;
    private final CurrentUserService currentUserService;

    public AdminAuditInterceptor(AdminAuditClassifier classifier, AdminAuditService auditService,
                                 CurrentUserService currentUserService) {
        this.classifier = classifier;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        try {
            String method = request.getMethod();
            if (!isMutation(method) || response.getStatus() >= 400) return;

            classifier.classify(method, pathWithinApp(request)).ifPresent(e -> {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                User actor = currentUserService.require(auth);
                auditService.record(actor, e.action(), e.targetType(), e.targetId(), e.merchantId(), null);
            });
        } catch (Exception e) {
            // Auditing must never affect the response (already sent) or surface an error.
            log.warn("Failed to write admin audit entry for {} {}: {}",
                    request.getMethod(), request.getRequestURI(), e.getMessage());
        }
    }

    private boolean isMutation(String method) {
        return "POST".equals(method) || "PUT".equals(method)
                || "PATCH".equals(method) || "DELETE".equals(method);
    }

    /** Request path with any context path stripped, so it starts at {@code /admin}. */
    private String pathWithinApp(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        return (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) ? uri.substring(ctx.length()) : uri;
    }
}
