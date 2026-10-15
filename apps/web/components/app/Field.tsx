"use client";
import type { ChangeEvent } from "react";
import { ChevronDown } from "../figma-icons";

/** Figma "Text field": 12px Inter label, 4px gap, 41px white input. */
export function Field({
  label,
  value,
  onChange,
  onEnter,
  placeholder,
  className = "",
  figma,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Enter pressed (e.g. add the typed language as a chip) */
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  /** design-check key (data-figma) — see apps/web/design-check */
  figma?: string;
}) {
  return (
    <label className={`field ${className}`.trim()} data-figma={figma}>
      <span className="field__label" data-figma={figma && `${figma}-label`}>{label}</span>
      <input
        className="field__input"
        data-figma={figma && `${figma}-input`}
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={
          onEnter &&
          ((e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          })
        }
      />
    </label>
  );
}

/**
 * Same field with a textarea. `height` is its height in Figma (115, 102, 256…); it grows with the
 * text where the browser supports `field-sizing` instead of showing a resize grip Figma doesn't have.
 */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  height,
  rows = 2,
  className = "",
  figma,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  height?: number;
  rows?: number;
  className?: string;
  figma?: string;
}) {
  return (
    <label className={`field ${className}`.trim()} data-figma={figma}>
      <span className="field__label">{label}</span>
      <textarea
        className="field__input field__textarea"
        data-figma={figma && `${figma}-input`}
        value={value}
        rows={rows}
        style={height ? { minHeight: height } : undefined}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </label>
  );
}

/** Native select styled as the Figma field, with the violet chevron. Empty value shows the placeholder. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  className = "",
  figma,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  figma?: string;
}) {
  return (
    <label className={`field ${className}`.trim()} data-figma={figma}>
      <span className="field__label">{label}</span>
      <span className="select">
        <select
          className={`field__input field__select${value ? "" : " is-placeholder"}`}
          data-figma={figma && `${figma}-input`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {/* mynaui:chevron-down cropped to its glyph: Figma's bare 11×5 vector */}
        <ChevronDown className="select__chevron" width={11} height={5} viewBox="6 9 12 6" preserveAspectRatio="none" overflow="visible" />
      </span>
    </label>
  );
}
