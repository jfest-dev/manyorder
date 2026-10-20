package com.manyorder.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.util.pattern.PathPattern;

import com.manyorder.api.domain.admin.AdminAuditClassifier;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Structural guard: every mutating route under {@code /admin/merchants/**} that
 * Spring actually registers must be recognised by {@link AdminAuditClassifier}, so
 * the audit interceptor records it. A new admin mutation whose path the classifier
 * does not understand fails this test. (suspend/unsuspend and protect/unprotect/
 * restore audit inline in the controller and are excluded.)
 */
class AdminAuditCoverageTest extends IntegrationTestBase {

    @Autowired @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;
    @Autowired private AdminAuditClassifier classifier;

    @Test
    void everyAdminMutationRouteIsClassified() {
        List<String> uncovered = new ArrayList<>();

        handlerMapping.getHandlerMethods().forEach((info, handler) -> {
            if (info.getPathPatternsCondition() == null) return;
            Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
            for (PathPattern pattern : info.getPathPatternsCondition().getPatterns()) {
                String path = pattern.getPatternString();
                if (!path.startsWith("/admin/merchants/")) continue;
                if (path.endsWith("/suspend") || path.endsWith("/unsuspend")
                        || path.endsWith("/protect") || path.endsWith("/unprotect")
                        || path.endsWith("/restore")) continue;
                for (RequestMethod rm : methods) {
                    String m = rm.name();
                    if (!m.equals("POST") && !m.equals("PUT") && !m.equals("PATCH") && !m.equals("DELETE")) continue;
                    // Build a concrete path by filling every {var} with a number.
                    String concrete = path.replaceAll("\\{[^/}]+}", "1");
                    if (classifier.classify(m, concrete).isEmpty()) {
                        uncovered.add(m + " " + path);
                    }
                }
            }
        });

        assertTrue(uncovered.isEmpty(),
                "Admin mutation endpoints not covered by the audit classifier: " + uncovered);
    }
}
