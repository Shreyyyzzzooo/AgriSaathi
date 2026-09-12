/**
 * Shared micro-UI components used across the dashboard.
 *
 * SkeletonCard      — animated loading placeholder
 * ErrorBanner       — dismissable error alert
 * Badge             — coloured pill badge
 */

import type { ReactNode } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  surface: "#1E293B",
  border:  "#334155",
  muted:   "#64748B",
  text:    "#F1F5F9",
  subtle:  "#94A3B8",
  green:   "#22C55E",
  amber:   "#F59E0B",
  red:     "#EF4444",
  blue:    "#3B82F6",
};

// ── SkeletonCard ──────────────────────────────────────────────────────────────

interface SkeletonCardProps { rows?: number; height?: number }

export function SkeletonCard({ rows = 3, height = 16 }: SkeletonCardProps) {
  return (
    <div style={{
      background: C.surface,
      borderRadius: 12,
      padding: "16px",
      border: `1px solid ${C.border}`,
      overflow: "hidden",
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 6,
            background: "linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
            marginBottom: i < rows - 1 ? 10 : 0,
            width: i === rows - 1 ? "60%" : "100%",
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  );
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div style={{
      background: "#450A0A",
      border: `1px solid ${C.red}`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      color: "#FCA5A5",
      fontSize: 13,
      fontFamily: "system-ui, sans-serif",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "#FCA5A5",
            cursor: "pointer",
            fontSize: 16,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "green" | "amber" | "red" | "blue" | "muted";

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  green: { bg: "#14532D", color: "#86EFAC", border: "#16A34A" },
  amber: { bg: "#451A03", color: "#FCD34D", border: "#D97706" },
  red:   { bg: "#450A0A", color: "#FCA5A5", border: "#DC2626" },
  blue:  { bg: "#1E3A5F", color: "#93C5FD", border: "#3B82F6" },
  muted: { bg: "#1E293B", color: "#94A3B8", border: "#334155" },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant = "muted", children }: BadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 20,
      padding: "2px 9px",
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "system-ui, sans-serif",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <>
      <div style={{
        width: size,
        height: size,
        border: `2px solid #334155`,
        borderTopColor: C.blue,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
