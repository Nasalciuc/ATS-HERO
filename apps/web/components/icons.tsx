"use client";
/* Inline SVG icons recreated to match the Figma iconography
   (Iconify sets: famicons, mage, ic, mynaui, iconoir, streamline, pepicons). */
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

export function ChevronDown({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 9l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRight({ size = 22, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowLeft({ size = 22, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plus({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Minus({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ic:baseline-block — circle with a diagonal bar */
export function Block({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.6 5.6l12.8 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* mynaui:star — filled star */
export function Star({ size = 22, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 2.6l2.74 5.55 6.13.89-4.43 4.32 1.05 6.1L12 16.98 6.51 19.96l1.05-6.1L3.13 9.04l6.13-.89L12 2.6z"
        fill="currentColor"
      />
    </svg>
  );
}

/* material-symbols:upload-rounded */
export function Upload({ size = 42, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 16V6m0 0L8 10m4-4l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* Hero PDF badge — stacked documents (Figma Group 180:125) */
export function PdfDocStack({ size = 32, ...p }: IconProps) {
  const h = (size * 35.8) / 32;
  return (
    <svg width={size} height={h} viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <rect x="2" y="1" width="18" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="5" width="18" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="#fff" />
      <path d="M10 12h10M10 16h10M10 20h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* mage:file-download — corner arrow icon */
export function DownloadArrow({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 18h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* mage:file-download — page with a down arrow */
export function FileDownload({ size = 32, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* pepicons-pencil:cv — document with text lines */
export function StatCv({ size = 36, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* mage:scan — frame corners with a scan line */
export function StatScan({ size = 36, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* streamline:graph-bar-increase — rising bars */
export function StatGraph({ size = 36, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="5" y="13" width="3.4" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.3" y="10" width="3.4" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15.6" y="6" width="3.4" height="12" rx="0.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l4-3 3 2 5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/* Guidance — stair steps */
export function FeatureSteps({ size = 26, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M4 19h4v-4h4v-4h4V7h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* In-depth analysis — gauge / speedometer */
export function FeatureGauge({ size = 26, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 16a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

/* Personalized approach — user */
export function FeatureUser({ size = 26, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* mage:bulb — Preview eye/bulb action */
export function Eye({ size = 20, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/* Save (floppy disk) */
export function Save({ size = 20, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 4v5h7V4M8 21v-6h8v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/* User outline (sidebar Sign in) */
export function UserIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 20c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ size = 22, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* Light bulb with sparkles — Pro Tips */
export function BulbTips({ size = 96, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M38 64h20M40 72h16M48 24c-11 0-20 8.7-20 19.5 0 7 3.8 12.4 8.5 16 1.6 1.2 2.5 2 2.5 4.5h18c0-2.5.9-3.3 2.5-4.5 4.7-3.6 8.5-9 8.5-16C68 32.7 59 24 48 24z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 30l2.2 5.8L88 38l-5.8 2.2L80 46l-2.2-5.8L72 38l5.8-2.2L80 30z" fill="currentColor" />
      <path d="M74 56l1.4 3.6L79 61l-3.6 1.4L74 66l-1.4-3.6L69 61l3.6-1.4L74 56z" fill="currentColor" />
    </svg>
  );
}

/* Trophy — used in sidebar/footer accents if needed */
export function Close({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GoogleIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p} aria-hidden>
      <path
        d="M21.6 12.2273C21.6 11.5182 21.5364 10.8364 21.4182 10.1818H12V14.05H17.3818C17.15 15.3 16.4455 16.3591 15.3864 17.0682V19.5773H18.6182C20.5091 17.8364 21.6 15.2727 21.6 12.2273Z"
        fill="#4285F4"
      />
      <path
        d="M12 22C14.7 22 16.9636 21.1045 18.6182 19.5773L15.3864 17.0682C14.4909 17.6682 13.3455 18.0227 12 18.0227C9.39545 18.0227 7.19091 16.2636 6.40455 13.9H3.06364V16.4909C4.70909 19.7591 8.09091 22 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.40455 13.9C6.20455 13.3 6.09091 12.6591 6.09091 12C6.09091 11.3409 6.20455 10.7 6.40455 10.1V7.50909H3.06364C2.38636 8.85909 2 10.3864 2 12C2 13.6136 2.38636 15.1409 3.06364 16.4909L6.40455 13.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.97727C13.4682 5.97727 14.7864 6.48182 15.8227 7.47273L18.6909 4.60455C16.9591 2.99091 14.6955 2 12 2C8.09091 2 4.70909 4.24091 3.06364 7.50909L6.40455 10.1C7.19091 7.73636 9.39545 5.97727 12 5.97727Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AppleIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p} aria-hidden>
      <path
        d="M16.365 12.636c-.03-3.223 2.633-4.767 2.752-4.842-1.498-2.19-3.832-2.49-4.663-2.523-1.985-.201-3.873 1.17-4.878 1.17-1.025 0-2.585-1.14-4.252-1.11-2.188.03-4.2 1.272-5.325 3.233-2.272 3.945-.582 9.78 1.633 12.987 1.083 1.566 2.372 3.323 4.066 3.26 1.634-.066 2.25-1.056 4.222-1.056 1.952 0 2.508 1.056 4.222 1.026 1.744-.03 2.843-1.575 3.913-3.15 1.233-1.8 1.743-3.54 1.773-3.63-.039-.018-3.403-1.305-3.433-5.175zM13.695 4.44c.898-1.09 1.504-2.604 1.338-4.11-1.294.052-2.858.863-3.787 1.953-.832.963-1.563 2.504-1.368 3.98 1.444.112 2.918-.733 3.817-1.823z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Radio control */
export function RadioDot({ checked, size = 22, ...p }: IconProps & { checked?: boolean }) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      {checked && <circle cx="12" cy="12" r="5" fill="currentColor" />}
    </svg>
  );
}

/* Small tag/chip leading icon */
export function Tag({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h5.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 11.2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7.5" cy="9.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

/* Globe — language chips */
export function Globe({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 2.5 14.7 0 17M12 3.5c-2.5 2.3-2.5 14.7 0 17" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* Check mark */
export function Check({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- wizard step icons (colored, match Figma nodes) ---------------- */
type SectionIconName =
  | "personalInfo"
  | "education"
  | "summary"
  | "work"
  | "skills"
  | "activities"
  | "awards"
  | "certifications"
  | "publications"
  | "volunteering";

export function SectionIcon({ name, size = 22 }: { name: SectionIconName; size?: number }) {
  const svg = (children: ReactNode) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
  switch (name) {
    case "personalInfo":
      return svg(
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill="#DCE9FF" stroke="#3B82F6" strokeWidth="1.4" />
          <circle cx="8.5" cy="11" r="2.2" fill="#3B82F6" />
          <path d="M5.6 16c.5-1.5 1.6-2.2 2.9-2.2s2.4.7 2.9 2.2" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M14 9.5h4.2M14 12h4.2M14 14.5h2.6" stroke="#3B82F6" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case "education":
      return svg(
        <>
          <path d="M12 4L2.5 9 12 14l9.5-5L12 4z" fill="#C7CCF7" stroke="#4F46E5" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6.5 11.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.5" stroke="#4F46E5" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M21 9v4" stroke="#4F46E5" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case "summary":
      return svg(
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.2" fill="#EDEBF7" stroke="#6B7280" strokeWidth="1.3" />
          <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case "work":
      return svg(
        <>
          <rect x="3" y="7.5" width="18" height="11.5" rx="2.2" fill="#FBE3CB" stroke="#C2742B" strokeWidth="1.3" />
          <path d="M9 7.5V6.2C9 5.5 9.5 5 10.2 5h3.6c.7 0 1.2.5 1.2 1.2v1.3" stroke="#C2742B" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M3 12h18" stroke="#C2742B" strokeWidth="1.3" />
          <rect x="10.6" y="11" width="2.8" height="2.4" rx="0.6" fill="#C2742B" />
        </>
      );
    case "skills":
      return svg(
        <>
          <path d="M3 12h2.5M18.5 12H21" stroke="#D9A300" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="5" y="8.5" width="3" height="7" rx="1.2" fill="#FCE9A6" stroke="#D9A300" strokeWidth="1.3" />
          <rect x="16" y="8.5" width="3" height="7" rx="1.2" fill="#FCE9A6" stroke="#D9A300" strokeWidth="1.3" />
          <rect x="8" y="10.4" width="8" height="3.2" rx="1.2" fill="#FCE9A6" stroke="#D9A300" strokeWidth="1.3" />
        </>
      );
    case "activities":
      return svg(
        <>
          <path d="M12 3l1.8 4.2H18l-3.6 2.8 1.4 4.5L12 12.8 8.2 14.5 9.6 9.8 6 7h4.2L12 3z" fill="#E8F0FE" stroke="#4285F4" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M10 14.5v4.5M14 14.5v4.5M8 19h8" stroke="#E0492E" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="12" cy="10.2" r="1.4" fill="#4285F4" />
        </>
      );
    case "awards":
      return svg(
        <>
          <path d="M7 4h10v3.5a5 5 0 0 1-10 0V4z" fill="#FBE7A6" stroke="#D9A300" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M7 5H4.5v1.5A2.5 2.5 0 0 0 7 9M17 5h2.5v1.5A2.5 2.5 0 0 1 17 9" stroke="#D9A300" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M12 12.5V16M9 20h6M10 20l.6-4M14 20l-.6-4" stroke="#D9A300" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "certifications":
      return svg(
        <>
          <rect x="3.5" y="4" width="17" height="12" rx="2" fill="#D5F0E6" stroke="#1F9D6B" strokeWidth="1.3" />
          <path d="M7 8h6M7 11h4" stroke="#1F9D6B" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="16.5" cy="16" r="3.4" fill="#FCE9A6" stroke="#1F9D6B" strokeWidth="1.3" />
          <path d="M14.7 18.6L14 22l2.5-1.4L19 22l-.7-3.4" stroke="#1F9D6B" strokeWidth="1.3" strokeLinejoin="round" />
        </>
      );
    case "publications":
      return svg(
        <>
          <path d="M12 6c-1.8-1.4-4-2-6.5-2H3v13h2.5c2.5 0 4.7.6 6.5 2 1.8-1.4 4-2 6.5-2H21V4h-2.5C16 4 13.8 4.6 12 6z" fill="#D8F0DA" stroke="#2E9E45" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M12 6v13" stroke="#2E9E45" strokeWidth="1.3" />
        </>
      );
    case "volunteering":
      return svg(
        <>
          <path d="M12 20s-6.5-3.8-6.5-8.3A3.5 3.5 0 0 1 12 9.4a3.5 3.5 0 0 1 6.5 2.3C18.5 16.2 12 20 12 20z" fill="#FBD3E2" stroke="#D6437E" strokeWidth="1.3" strokeLinejoin="round" />
        </>
      );
  }
}

/* Analyze flow — clipboard on step 1 (Figma) */
export function AnalyzeClipboard({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="5" y="4" width="14" height="17" rx="2" fill="#F5E6C8" stroke="#C4A574" strokeWidth="1.2" />
      <path d="M8.5 4h7a1.2 1.2 0 0 1 1.2 1.2V7H7.3V5.2A1.2 1.2 0 0 1 8.5 4z" fill="#E8E8E8" stroke="#AAA" strokeWidth="1" />
      <path d="M8.5 10.5h7M8.5 13.5h5.5" stroke="#B8956A" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ATS loading — resume with profile badge */
export function LoadingResume({ size = 52, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="6" y="3" width="13" height="18" rx="2" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8h7M9 11.5h7M9 15h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16.5" cy="7" r="3.2" fill="#fff" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="16.5" cy="6.5" r="1.1" fill="currentColor" />
      <path d="M15 8.8c.6-.8 1.4-.8 2 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function Magnify({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 15l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Trash({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l.8 12h8.4L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 10.5v5M14 10.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LightbulbBadge({ size = 12, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M9 17h6M10 20h4M12 3c-3 0-5.5 2.2-5.5 5 0 2 1 3.5 2.2 4.5.5.4.8.9.8 1.5h5c0-.6.3-1.1.8-1.5 1.2-1 2.2-2.5 2.2-4.5C17.5 5.2 15 3 12 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function BriefcaseSm({ size = 13, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="8" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function FolderSm({ size = 13, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function PersonSm({ size = 13, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* Warning triangle — score badges */
export function Warn({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}
