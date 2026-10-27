package com.manyorder.api.domain.admin;

import org.junit.jupiter.api.Test;

import com.manyorder.api.domain.admin.AdminAuditClassifier.Entry;

import static org.assertj.core.api.Assertions.assertThat;

/** The path classifier maps each admin mutation to its audit fields; target id comes from the path. */
class AdminAuditClassifierTest {

    private final AdminAuditClassifier classifier = new AdminAuditClassifier();

    @Test
    void entityMutationsCarryTheRowIdFromThePath() {
        assertThat(classifier.classify("DELETE", "/admin/merchants/5/products/9"))
                .contains(new Entry("DELETE_PRODUCT", "PRODUCT", 9L, 5L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/5/products/9"))
                .contains(new Entry("UPDATE_PRODUCT", "PRODUCT", 9L, 5L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/5/products/9/activate"))
                .contains(new Entry("ACTIVATE_PRODUCT", "PRODUCT", 9L, 5L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/5/products/9/deactivate"))
                .contains(new Entry("DEACTIVATE_PRODUCT", "PRODUCT", 9L, 5L));
        assertThat(classifier.classify("DELETE", "/admin/merchants/3/customers/8"))
                .contains(new Entry("DELETE_CUSTOMER", "CUSTOMER", 8L, 3L));
        assertThat(classifier.classify("PUT", "/admin/merchants/3/customers/8"))
                .contains(new Entry("UPDATE_CUSTOMER", "CUSTOMER", 8L, 3L));
        assertThat(classifier.classify("DELETE", "/admin/merchants/3/discounts/2"))
                .contains(new Entry("DELETE_DISCOUNT", "DISCOUNT", 2L, 3L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/3/discounts/2/deactivate"))
                .contains(new Entry("DEACTIVATE_DISCOUNT", "DISCOUNT", 2L, 3L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/3/discounts/2/activate"))
                .contains(new Entry("ACTIVATE_DISCOUNT", "DISCOUNT", 2L, 3L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/3/orders/7/status"))
                .contains(new Entry("UPDATE_ORDER_STATUS", "ORDER", 7L, 3L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/3/orders/7/payment-status"))
                .contains(new Entry("UPDATE_ORDER_PAYMENT_STATUS", "ORDER", 7L, 3L));
    }

    @Test
    void createsHaveNoTargetIdInThePath() {
        assertThat(classifier.classify("POST", "/admin/merchants/5/products"))
                .contains(new Entry("CREATE_PRODUCT", "PRODUCT", null, 5L));
        assertThat(classifier.classify("POST", "/admin/merchants/5/customers"))
                .contains(new Entry("CREATE_CUSTOMER", "CUSTOMER", null, 5L));
        assertThat(classifier.classify("POST", "/admin/merchants/5/discounts"))
                .contains(new Entry("CREATE_DISCOUNT", "DISCOUNT", null, 5L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/5/products/reorder"))
                .contains(new Entry("REORDER_PRODUCTS", "PRODUCT", null, 5L));
        assertThat(classifier.classify("PATCH", "/admin/merchants/5/discounts/reorder"))
                .contains(new Entry("REORDER_DISCOUNTS", "DISCOUNT", null, 5L));
    }

    @Test
    void suspendUnsuspendAndNonMutationsAreNotClassified() {
        assertThat(classifier.classify("POST", "/admin/merchants/5/suspend")).isEmpty();
        assertThat(classifier.classify("POST", "/admin/merchants/5/unsuspend")).isEmpty();
        assertThat(classifier.classify("GET", "/admin/merchants/5/products/9")).isEmpty();
        assertThat(classifier.classify("GET", "/admin/merchants/5/products")).isEmpty();
    }
}
