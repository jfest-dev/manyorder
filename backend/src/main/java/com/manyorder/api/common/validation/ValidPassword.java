package com.manyorder.api.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The single password-strength rule for the app: at least 8 characters and at
 * least one digit. Applied everywhere a password is set (register, reset,
 * change) so the requirement can never drift between entry points. Pair with
 * {@code @NotBlank}, which owns the "must be present" check.
 */
@Documented
@Constraint(validatedBy = PasswordConstraintValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidPassword {

    String message() default "Password must be at least 8 characters and include at least one number.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
