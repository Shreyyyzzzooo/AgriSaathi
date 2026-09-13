/**
 * Shared micro-UI components used across AgriSaathi.
 * Styled with the deep forest / nature-tech design tokens.
 */

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
export const PALETTE = {
  surface: "rgba(10, 34, 26, 0.72)",
  surfaceGlass: "rgba(196, 231, 238, 0.08)",
  border: "rgba(76, 255, 160, 0.22)",
  borderHover: "rgba(76, 255, 160, 0.5)",
  muted: "rgba(242, 247, 239, 0.65)",
  text: "#FBFFFC",
  subtle: "rgba(242, 247, 239, 0.85)",
  green: "#4CFFA0",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#38BDF8",
};

// ── PageHeader ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, onBack, actions }: PageHeaderProps) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 28px",
      borderBottom: `1px solid ${PALETTE.border}`,
      background: "rgba(4, 20, 15, 0.85)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      position: "sticky",
      top: 0,
      zIndex: 40,
      width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "rgba(76, 255, 160, 0.1)",
              border: `1px solid ${PALETTE.border}`,
              borderRadius: "8px",
              color: "#A7F3D0",
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: "13.5px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.2)";
              e.currentTarget.style.borderColor = PALETTE.green;
              e.currentTarget.style.color = "#FFFFFF";
              e.currentTarget.style.transform = "translateX(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.1)";
              e.currentTarget.style.borderColor = PALETTE.border;
              e.currentTarget.style.color = "#A7F3D0";
              e.currentTarget.style.transform = "none";
            }}
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {icon && <span style={{ fontSize: 24, display: "flex", alignItems: "center" }}>{icon}</span>}
          <div>
            <h1 style={{
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: 0,
              color: PALETTE.text,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{
                color: PALETTE.muted,
                fontSize: "12.5px",
                margin: "2px 0 0",
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {actions}
        </div>
      )}
    </header>
  );
}

// ── FeatureCard ───────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionText: string;
  onClick: () => void;
  badge?: string;
}

export function FeatureCard({ icon, title, description, actionText, onClick, badge }: FeatureCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(10, 34, 26, 0.65)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${PALETTE.border}`,
        borderRadius: "14px",
        padding: "24px 22px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = PALETTE.borderHover;
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 18px 45px rgba(0, 0, 0, 0.4), 0 0 30px rgba(76, 255, 160, 0.12)";
        e.currentTarget.style.background = "rgba(14, 44, 34, 0.78)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = PALETTE.border;
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.25)";
        e.currentTarget.style.background = "rgba(10, 34, 26, 0.65)";
      }}
    >
      {badge && (
        <div style={{
          position: "absolute",
          top: 14,
          right: 14,
          background: "rgba(76, 255, 160, 0.15)",
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 20,
          padding: "2px 8px",
          fontSize: "11px",
          fontWeight: 700,
          color: PALETTE.green,
        }}>
          {badge}
        </div>
      )}
      <div>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "10px",
          background: "rgba(76, 255, 160, 0.1)",
          border: "1px solid rgba(76, 255, 160, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          marginBottom: 16,
          color: PALETTE.green,
        }}>
          {icon}
        </div>
        <h3 style={{
          fontSize: "18px",
          fontWeight: 700,
          margin: "0 0 8px",
          color: PALETTE.text,
          letterSpacing: "-0.01em",
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: "13.5px",
          lineHeight: 1.55,
          color: PALETTE.muted,
          margin: 0,
        }}>
          {description}
        </p>
      </div>

      <div style={{
        marginTop: 20,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: PALETTE.green,
        fontWeight: 700,
        fontSize: "13.5px",
      }}>
        <span>{actionText}</span>
        <span>→</span>
      </div>
    </div>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

interface SkeletonCardProps { rows?: number; height?: number }

export function SkeletonCard({ rows = 3, height = 16 }: SkeletonCardProps) {
  return (
    <div style={{
      background: "rgba(10, 34, 26, 0.65)",
      borderRadius: 12,
      padding: "18px",
      border: `1px solid ${PALETTE.border}`,
      overflow: "hidden",
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 6,
            background: "linear-gradient(90deg, rgba(10,34,26,0.5) 25%, rgba(20,54,42,0.8) 50%, rgba(10,34,26,0.5) 75%)",
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
      background: "rgba(69, 10, 10, 0.8)",
      border: `1px solid ${PALETTE.red}`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      color: "#FCA5A5",
      fontSize: 13,
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
  green: { bg: "rgba(22, 101, 52, 0.4)", color: "#86EFAC", border: "rgba(76, 255, 160, 0.45)" },
  amber: { bg: "rgba(120, 53, 15, 0.4)", color: "#FCD34D", border: "rgba(245, 158, 11, 0.45)" },
  red:   { bg: "rgba(127, 29, 29, 0.4)", color: "#FCA5A5", border: "rgba(239, 68, 68, 0.45)" },
  blue:  { bg: "rgba(14, 116, 144, 0.4)", color: "#7DD3FC", border: "rgba(56, 189, 248, 0.45)" },
  muted: { bg: "rgba(15, 30, 25, 0.6)", color: "#94A3B8", border: "rgba(51, 65, 85, 0.5)" },
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
      padding: "3px 10px",
      fontSize: 11.5,
      fontWeight: 700,
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
        border: "2px solid rgba(76, 255, 160, 0.2)",
        borderTopColor: PALETTE.green,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        display: "inline-block",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
