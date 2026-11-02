package com.manyorder.api.domain.admin;

/** A minimal {id, name} reference for a store or person named in the admin dashboard,
 *  so every number can point at the store or person behind it. */
public interface NamedRef {
    Long getId();
    String getName();
}
