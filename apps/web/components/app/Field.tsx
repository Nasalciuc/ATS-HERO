"use client";
import type { ChangeEvent } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  figma,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** design-check key (data-figma) — see apps/web/design-check */
  figma?: string;
}) {
  return (
    <label className="field" data-figma={figma}>
      <span className="field__label" data-figma={figma && `${figma}-label`}>{label}</span>
      <input
        className="field__input"
        data-figma={figma && `${figma}-input`}
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <textarea
        className="field__input field__textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </label>
  );
}
