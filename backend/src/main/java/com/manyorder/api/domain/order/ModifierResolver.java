package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.product.ModifierGroup;
import com.manyorder.api.domain.product.ModifierOption;
import com.manyorder.api.domain.product.Product;

/**
 * Turns the client-sent modifier option ids for one order line into validated,
 * priced snapshots — the single trust boundary for modifiers, shared by guest
 * checkout and merchant-entered orders. The client only ever sends ids; every
 * price and the min/max/required rules are re-derived here from the product, so
 * a tampered or stale storefront can't bypass them.
 */
public final class ModifierResolver {

    private ModifierResolver() {}

    /** One resolved choice, snapshotted so history survives later modifier edits. */
    public record Selection(String groupName, String optionName, BigDecimal priceDelta, Long sourceOptionId) {}

    /** The validated selections for a line plus the per-unit modifier total. */
    public record Resolution(List<Selection> selections, BigDecimal totalPerUnit) {}

    public static Resolution resolve(Product product, List<Long> selectedOptionIds) {
        List<Long> ids = selectedOptionIds == null ? List.of() : selectedOptionIds;

        if (new HashSet<>(ids).size() != ids.size()) {
            throw badRequest("The same modifier option was selected more than once.");
        }

        // Index this product's options, and which group each belongs to.
        Map<Long, ModifierOption> optionById = new HashMap<>();
        Map<Long, ModifierGroup> groupByOptionId = new HashMap<>();
        for (ModifierGroup g : product.getModifierGroups()) {
            for (ModifierOption o : g.getOptions()) {
                optionById.put(o.getId(), o);
                groupByOptionId.put(o.getId(), g);
            }
        }

        // Every selected id must belong to THIS product.
        for (Long id : ids) {
            if (!optionById.containsKey(id)) {
                throw badRequest("A selected option isn't available for this product.");
            }
        }

        // Enforce min/max/required for every group of the product.
        Map<Long, Long> countByGroupId = new HashMap<>();
        for (Long id : ids) {
            countByGroupId.merge(groupByOptionId.get(id).getId(), 1L, Long::sum);
        }
        for (ModifierGroup g : product.getModifierGroups()) {
            long count = countByGroupId.getOrDefault(g.getId(), 0L);
            if (count < g.getMinSelect()) {
                throw badRequest("Please choose at least " + g.getMinSelect() + " for \"" + g.getName() + "\".");
            }
            if (g.getMaxSelect() != null && count > g.getMaxSelect()) {
                throw badRequest("Choose at most " + g.getMaxSelect() + " for \"" + g.getName() + "\".");
            }
        }

        // Build snapshots in group/option order, tallying the per-unit delta.
        Set<Long> selected = new HashSet<>(ids);
        List<Selection> selections = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (ModifierGroup g : product.getModifierGroups()) {
            for (ModifierOption o : g.getOptions()) {
                if (selected.contains(o.getId())) {
                    selections.add(new Selection(g.getName(), o.getName(), o.getPriceDelta(), o.getId()));
                    total = total.add(o.getPriceDelta());
                }
            }
        }
        return new Resolution(selections, total);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
