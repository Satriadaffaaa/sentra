"use client";

import React, { useId } from "react";
import styles from "./InputGroup.module.css";
import { formatNumberWithSeparator, parseFormattedNumber } from "@/lib/formatHelpers";

interface InputGroupProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  label?: string;
  prefixText?: string;
  prefixIcon?: React.ReactNode;
  suffixText?: string;
  suffixIcon?: React.ReactNode;
  as?: "input" | "select";
  children?: React.ReactNode; // For select option children
  isCurrency?: boolean;
  currency?: string;
}

export default function InputGroup({
  label,
  prefixText,
  prefixIcon,
  suffixText,
  suffixIcon,
  as = "input",
  children,
  className = "",
  isCurrency = false,
  currency = "IDR",
  ...props
}: InputGroupProps) {
  const generatedId = useId();
  const inputId = props.id || generatedId;

  const hasPrefix = !!prefixText || !!prefixIcon;
  const hasSuffix = !!suffixText || !!suffixIcon;

  // Custom value and onChange logic for formatted currency input
  let inputValue = props.value;
  let inputOnChange = props.onChange;
  let inputType = props.type;

  if (isCurrency && as === "input") {
    inputType = "text";
    inputValue = props.value !== undefined && props.value !== null
      ? formatNumberWithSeparator(String(props.value), currency)
      : "";

    inputOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (props.onChange) {
        const rawDigits = parseFormattedNumber(e.target.value, currency).toString();
        // Clone event and modify value to pass raw digits back to parent
        const customEvent = {
          ...e,
          target: {
            ...e.target,
            value: rawDigits,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        props.onChange(customEvent);
      }
    };
  }

  return (
    <div className={styles.formGroup}>
      {label && (
        <label htmlFor={inputId} className={styles.formLabel}>
          {label}
        </label>
      )}
      <div
        className={`${styles.inputGroupContainer} ${
          hasPrefix ? styles.hasPrefix : ""
        } ${hasSuffix ? styles.hasSuffix : ""}`}
      >
        {hasPrefix && (
          <span className={styles.inputPrefix}>
            {prefixIcon && <span className={styles.prefixIconWrapper}>{prefixIcon}</span>}
            {prefixText && <span className={styles.prefixTextWrapper}>{prefixText}</span>}
          </span>
        )}

        {as === "select" ? (
          <select
            id={inputId}
            className={`${styles.inputField} ${styles.selectField} ${className}`}
            {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
          >
            {children}
          </select>
        ) : (
          <input
            id={inputId}
            type={inputType}
            className={`${styles.inputField} ${className}`}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
            value={inputValue}
            onChange={inputOnChange}
          />
        )}

        {hasSuffix && (
          <span className={styles.inputSuffix}>
            {suffixIcon && <span className={styles.suffixIconWrapper}>{suffixIcon}</span>}
            {suffixText && <span className={styles.suffixTextWrapper}>{suffixText}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

