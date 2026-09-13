/**
 * ProfitHistogram — Recharts BarChart showing profit probability distribution.
 *
 * Renders the 10-bin histogram from CropStats.histogram_bins.
 * Bins left of zero are shaded red (loss zone); right of zero are green (gain).
 * Vertical reference lines for p10, p50, p90.
 */

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import type { CropStats } from "../../types/api";

interface ProfitHistogramProps {
  stats: CropStats;
  cropName: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000)   return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function ProfitHistogram({ stats, cropName }: ProfitHistogramProps) {
  const bins = stats.histogram_bins; // 11 edges → 10 bars
  const counts = stats.histogram_counts; // 10 bars
  if (!bins || bins.length < 11 || !counts || counts.length < 10) return null;

  // Build chart data from bin edges and frequencies
  const data = Array.from({ length: 10 }, (_, i) => ({
    name: fmt(bins[i]),
    midpoint: (bins[i] + bins[i + 1]) / 2,
    value: counts[i],
  }));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontSize: 11, color: "#64748B", marginBottom: 4,
        fontFamily: "system-ui, sans-serif",
      }}>
        Profit distribution — {cropName}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "#64748B" }}
            interval={1}
          />
          <YAxis hide />
          <Tooltip
            formatter={(_v: unknown, _n: unknown, props: { payload?: { midpoint?: number } }) =>
              [`${fmt(props?.payload?.midpoint ?? 0)}`, "Bin centre"]
            }
            contentStyle={{
              background: "#1E293B",
              border: "1px solid #334155",
              fontSize: 11,
              color: "#F1F5F9",
            }}
          />
          {/* p10 / p50 / p90 reference lines */}
          <ReferenceLine
            x={fmt(stats.p10)}
            stroke="#EF4444"
            strokeDasharray="3 3"
            label={{ value: "p10", fill: "#EF4444", fontSize: 9 }}
          />
          <ReferenceLine
            x={fmt(stats.p50)}
            stroke="#22C55E"
            strokeDasharray="3 3"
            label={{ value: "p50", fill: "#22C55E", fontSize: 9 }}
          />
          <ReferenceLine
            x={fmt(stats.p90)}
            stroke="#3B82F6"
            strokeDasharray="3 3"
            label={{ value: "p90", fill: "#3B82F6", fontSize: 9 }}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.midpoint < 0 ? "#991B1B" : "#15803D"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
