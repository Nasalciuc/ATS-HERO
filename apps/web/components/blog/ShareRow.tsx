"use client";
// "Share this guide" under the questions: copy the post's address, or open LinkedIn's share page in
// a new tab. The LinkedIn button is a plain link: nothing of LinkedIn's loads on our page, and the
// post's public address is all it carries.
import { useEffect, useRef, useState } from "react";

export default function ShareRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; // no clipboard here (an old browser, or the permission refused): the address bar has it
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="blog-share">
      <p className="blog-share__label">Share this guide</p>
      <div className="blog-share__actions">
        <button type="button" className={`blog-share__button${copied ? " is-done" : ""}`} onClick={copy}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {copied ? (
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            ) : (
              <>
                <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" />
                <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
              </>
            )}
          </svg>
          <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
        </button>
        <a
          className="blog-share__button"
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M14 4h6v6M20 4l-9 9" />
            <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
          </svg>
          Share on LinkedIn
        </a>
      </div>
    </div>
  );
}
