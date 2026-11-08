package com.manyorder.api.domain.admin;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards that every audit action code the backend records is one of the known actions, so
 * the frontend's readable-label list (adminActions.ts) can cover them all. If a new action
 * is added in the classifier or the store lifecycle without being listed here, this fails,
 * which is the cue to add its plain-words label on the frontend too.
 */
class AdminAuditActionsTest {

    /** The known audit action codes. Keep in step with AUDIT_ACTIONS in
     *  frontend/src/components/admin/adminActions.ts (a frontend test checks each has a label). */
    private static final Set<String> KNOWN = new LinkedHashSet<>(java.util.List.of(
            "SUSPEND_MERCHANT", "UNSUSPEND_MERCHANT", "PROTECT_STORE", "UNPROTECT_STORE", "RESTORE_STORE",
            "CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT", "ACTIVATE_PRODUCT", "DEACTIVATE_PRODUCT", "REORDER_PRODUCTS",
            "CREATE_CUSTOMER", "UPDATE_CUSTOMER", "DELETE_CUSTOMER",
            "CREATE_DISCOUNT", "UPDATE_DISCOUNT", "DELETE_DISCOUNT", "ACTIVATE_DISCOUNT", "DEACTIVATE_DISCOUNT", "REORDER_DISCOUNTS",
            "UPDATE_ORDER_STATUS", "UPDATE_ORDER_PAYMENT_STATUS", "REMIND_OWNER"));

    private static final Path ADMIN = Path.of("src/main/java/com/manyorder/api/domain/admin");

    @Test
    void everyAuditActionRecordedInCodeIsKnown() throws IOException {
        Set<String> used = new TreeSet<>();
        // Actions produced by the request classifier: entry("ACTION", ...).
        collect(ADMIN.resolve("AdminAuditClassifier.java"), Pattern.compile("entry\\(\\s*\"([A-Z_]{4,})\""), used);
        // Actions recorded directly by the store lifecycle endpoints.
        Path mc = ADMIN.resolve("AdminMerchantController.java");
        collect(mc, Pattern.compile("record\\(\\s*\\w+\\s*,\\s*\"([A-Z_]{4,})\""), used);
        collect(mc, Pattern.compile("setProtection\\([^,]+,[^,]+,\\s*\"([A-Z_]{4,})\""), used);

        Set<String> unknown = new TreeSet<>(used);
        unknown.removeAll(KNOWN);
        assertTrue(unknown.isEmpty(),
                "audit actions used in code but not in the known list (add them here and give them a label on the frontend): " + unknown);
        // And the recorded set is non-trivial, so the scan is actually finding actions.
        assertTrue(used.size() >= 15, "expected to find the audit actions; found: " + used);
    }

    private static void collect(Path file, Pattern p, Set<String> into) throws IOException {
        String src = Files.readString(file);
        Matcher m = p.matcher(src);
        while (m.find()) into.add(m.group(1));
    }
}
