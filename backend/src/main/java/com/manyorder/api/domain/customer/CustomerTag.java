package com.manyorder.api.domain.customer;

import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * One informational customer label with a palette color. Free-form name; the
 * color is a fixed palette key (unknown values coerce to {@link #DEFAULT_COLOR}),
 * so styling stays centralized and the stored data is constrained.
 */
@Embeddable
public class CustomerTag {

    /** Allowed palette keys. Kept in sync with the frontend TAG_COLORS map. */
    public static final Set<String> COLORS = Set.of("gray", "orange", "blue", "pink", "purple");
    public static final String DEFAULT_COLOR = "gray";

    @Column(name = "tag", nullable = false, length = 30)
    private String name;

    // Default lets ddl-auto add this column to the pre-existing customer_tags rows.
    @Column(name = "color", nullable = false, columnDefinition = "varchar(16) default 'gray' not null")
    private String color;

    protected CustomerTag() {
        // JPA only
    }

    public CustomerTag(String name, String color) {
        this.name = name;
        this.color = COLORS.contains(color) ? color : DEFAULT_COLOR;
    }

    public String getName() {
        return name;
    }

    public String getColor() {
        return color;
    }
}
