package com.manyorder.api.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PasswordConstraintValidator implements ConstraintValidator<ValidPassword, String> {

    private static final int MIN_LENGTH = 8;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Null is left to @NotBlank; strength is only meaningful for a present value.
        if (value == null) return true;
        return value.length() >= MIN_LENGTH && value.chars().anyMatch(Character::isDigit);
    }
}
