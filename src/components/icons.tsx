/* Inline SVG icons recreated to match the Figma iconography
   (Iconify sets: famicons, mage, ic, mynaui, iconoir, streamline, pepicons). */
import type { SVGProps } from "react";

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

/* Radio control */
export function RadioDot({ checked, size = 22, ...p }: IconProps & { checked?: boolean }) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      {checked && <circle cx="12" cy="12" r="5" fill="currentColor" />}
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
