import { useState, useMemo, useEffect } from "react";
import { fetchMarketPrices, fetchMarketLocations } from "../../services/apiClient";
import type { MarketPriceResponse } from "../../types/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { getTranslation } from "../../i18n";
import { useFarm } from "../../context/FarmContext";

export function MarketPriceDashboard() {
  const { lang } = useFarm();
  const [locations, setLocations] = useState<Record<string, string[]>>({});
  const [loadingLocations, setLoadingLocations] = useState(true);

  const [state, setState] = useState<string>("Punjab");
  const [district, setDistrict] = useState<string>("All");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MarketPriceResponse | null>(null);

  const [selectedCropTrend, setSelectedCropTrend] = useState<string>("");
  const [tableSearch, setTableSearch] = useState<string>("");

  // Load locations on mount
  useEffect(() => {
    async function loadLocs() {
      try {
        const resp = await fetchMarketLocations();
        setLocations(resp.locations);
        const states = Object.keys(resp.locations);
        if (states.length > 0) {
          const defaultState = states.includes("Punjab") ? "Punjab" : states[0];
          setState(defaultState);
          setDistrict("All");
          // Trigger initial fetch
          loadPrices(defaultState, "All");
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
        // Fallback default state
        loadPrices("Punjab", "All");
      } finally {
        setLoadingLocations(false);
      }
    }
    loadLocs();
  }, []);

  const loadPrices = async (st: string, dist: string) => {
    if (!st) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMarketPrices(st, dist === "All" ? undefined : dist);
      setData(result);
      if (result.prices.length > 0) {
        setSelectedCropTrend(result.prices[0].crop);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Unable to load market prices.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = () => {
    loadPrices(state, district);
  };

  // Derived Statistics
  const stats = useMemo(() => {
    if (!data || data.prices.length === 0) return null;
    const prices = data.prices;

    const highest = prices.reduce((prev, curr) => (curr.modal_price > prev.modal_price ? curr : prev));
    const avg = prices.reduce((sum, curr) => sum + curr.modal_price, 0) / prices.length;
    const markets = new Set(prices.map((p) => p.market)).size;
    const totalCrops = new Set(prices.map((p) => p.crop)).size;

    return { highest, avg, markets, totalCrops };
  }, [data]);

  // Current Prices for Bar Chart (Top 12 by modal price)
  const currentPrices = useMemo(() => {
    if (!data) return [];
    const cropMap = new Map<string, { total: number; count: number }>();

    data.prices.forEach((p) => {
      if (!cropMap.has(p.crop)) cropMap.set(p.crop, { total: 0, count: 0 });
      const entry = cropMap.get(p.crop)!;
      entry.total += p.modal_price;
      entry.count += 1;
    });

    const result = Array.from(cropMap.entries()).map(([crop, val]) => ({
      crop,
      price: Math.round(val.total / val.count),
    }));

    return result.sort((a, b) => b.price - a.price).slice(0, 12);
  }, [data]);

  // Trend Data for Line Chart (from 7-day trend API)
  const trendData = useMemo(() => {
    if (!data || !selectedCropTrend) return [];
    if (data.trends && data.trends[selectedCropTrend]) {
      return data.trends[selectedCropTrend];
    }
    // Fallback: group from prices if trend model not attached
    const cropPrices = data.prices.filter((p) => p.crop === selectedCropTrend);
    if (cropPrices.length === 0) return [];
    const first = cropPrices[0];
    return [
      { date: first.arrival_date, price: first.modal_price, min_price: first.min_price, max_price: first.max_price }
    ];
  }, [data, selectedCropTrend]);

  // Filtered Table Records
  const filteredPrices = useMemo(() => {
    if (!data) return [];
    if (!tableSearch.trim()) return data.prices;
    const q = tableSearch.toLowerCase();
    return data.prices.filter(
      (p) =>
        p.crop.toLowerCase().includes(q) ||
        p.market.toLowerCase().includes(q) ||
        (p.district && p.district.toLowerCase().includes(q)) ||
        (p.variety && p.variety.toLowerCase().includes(q))
    );
  }, [data, tableSearch]);

  const availableDistricts = useMemo(() => {
    return locations[state] || [];
  }, [locations, state]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. LOCATION FILTER PANEL */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
          padding: "24px",
          borderRadius: "14px",
          border: "1px solid rgba(76, 255, 160, 0.25)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ color: "#4CFFA0", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>📍</span> LIVE AGMARKNET LOCATION SELECTOR
          </div>
          <span style={{ fontSize: "11px", color: "#64748B" }}>
            {loadingLocations ? "Loading mandis..." : `${Object.keys(locations).length} States Reporting Today`}
          </span>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* State selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "220px" }}>
            <label style={{ color: "#CBD5E1", fontSize: "14px", fontWeight: 500 }}>State</label>
            <select
              value={state}
              onChange={(e) => {
                const newState = e.target.value;
                setState(newState);
                setDistrict("All");
                loadPrices(newState, "All");
              }}
              style={{
                padding: "11px 14px",
                background: "rgba(8, 22, 26, 0.6)",
                border: "1px solid rgba(76, 255, 160, 0.25)",
                color: "#F7FBF4",
                borderRadius: "8px",
                outline: "none",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              {Object.keys(locations).length === 0 ? (
                <option value="Punjab">Punjab</option>
              ) : (
                Object.keys(locations).map((s) => (
                  <option key={s} value={s}>
                    {s} ({locations[s]?.length || 0} districts)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* District selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "220px" }}>
            <label style={{ color: "#CBD5E1", fontSize: "14px", fontWeight: 500 }}>District / Mandi</label>
            <select
              value={district}
              onChange={(e) => {
                const newDist = e.target.value;
                setDistrict(newDist);
                loadPrices(state, newDist);
              }}
              style={{
                padding: "11px 14px",
                background: "rgba(8, 22, 26, 0.6)",
                border: "1px solid rgba(76, 255, 160, 0.25)",
                color: "#F7FBF4",
                borderRadius: "8px",
                outline: "none",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <option value="All">All Mandis (State-wide)</option>
              {availableDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleFetch}
            disabled={!state || loading}
            style={{
              padding: "11px 26px",
              background: loading ? "rgba(8, 22, 26, 0.7)" : "linear-gradient(135deg, rgba(76,255,160,0.25), rgba(46,200,110,0.3))",
              color: loading ? "rgba(242,247,239,0.5)" : "#4CFFA0",
              border: loading ? "1px solid rgba(76,255,160,0.1)" : "1px solid rgba(76,255,160,0.4)",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 2px 10px rgba(76,255,160,0.2)",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {loading ? "Refreshing Data..." : "Refresh Mandi Prices ↻"}
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(185, 28, 28, 0.15)",
            color: "#FCA5A5",
            borderRadius: "10px",
            border: "1px solid #EF4444",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <strong>Unable to load market prices:</strong> {error}
          </div>
        </div>
      )}

      {/* TRANSPARENT NOTICE BANNER */}
      {data?.notice && (
        <div
          style={{
            padding: "14px 20px",
            background: "rgba(245, 158, 11, 0.12)",
            color: "#FCD34D",
            borderRadius: "10px",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
          }}
        >
          <span style={{ fontSize: "18px" }}>ℹ️</span>
          <span>{data.notice}</span>
        </div>
      )}

      {/* DASHBOARD CONTENT */}
      {data && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Header Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", color: "#F8FAFC", fontWeight: 700 }}>
                📍 {data.location.district === "All" ? `All Mandis in ${data.location.state}` : `${data.location.district}, ${data.location.state}`}
              </h2>
              <p style={{ margin: "6px 0 0 0", color: "#94A3B8", fontSize: "14px" }}>
                Official daily commodity arrivals and modal prices from Agmarknet
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ADE80",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                ● Live Data Connected
              </span>
              <span style={{ color: "#64748B", fontSize: "12px" }}>
                Updated: {new Date().toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <StatCard
              title="HIGHEST MODAL PRICE"
              value={`₹${stats.highest.modal_price.toLocaleString("en-IN")}`}
              subtitle={`${stats.highest.crop} (${stats.highest.market})`}
              color="#38BDF8"
            />
            <StatCard
              title="AVERAGE MANDI PRICE"
              value={`₹${Math.round(stats.avg).toLocaleString("en-IN")}`}
              subtitle="/ quintal across reporting crops"
              color="#A855F7"
            />
            <StatCard
              title="APMC MARKETS"
              value={stats.markets.toString()}
              subtitle="mandis reporting in area today"
              color="#22C55E"
            />
            <StatCard
              title="COMMODITIES TRACKED"
              value={stats.totalCrops.toString()}
              subtitle="crops with arrivals reported"
              color="#F59E0B"
            />
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
            {/* CURRENT PRICES BAR CHART */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
                padding: "24px",
                borderRadius: "14px",
                border: "1px solid rgba(76, 255, 160, 0.2)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#F1F5F9", fontWeight: 700 }}>
                  📊 {getTranslation(lang, "currentPrices").toUpperCase()} (₹/quintal)
                </h3>
                <span style={{ color: "#64748B", fontSize: "12px" }}>Top commodities</span>
              </div>
              <div style={{ height: "320px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentPrices} layout="vertical" margin={{ top: 0, right: 30, left: 50, bottom: 0 }}>
                    <XAxis type="number" stroke="rgba(242,247,239,0.4)" fontSize={11} tickFormatter={(val) => `₹${val}`}
                      label={{ value: "₹/quintal", position: "insideBottomRight", offset: -10, style: { fill: "rgba(242,247,239,0.5)", fontSize: 10 } }}
                    />
                    <YAxis type="category" dataKey="crop" stroke="rgba(242,247,239,0.6)" fontSize={12} width={100} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(76, 255, 160, 0.06)" }}
                      contentStyle={{
                        background: "rgba(6, 23, 19, 0.95)",
                        border: "1px solid rgba(76,255,160,0.3)",
                        borderRadius: "8px",
                        color: "#F7FBF4",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                      formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Modal Price"]}
                    />
                    <Bar dataKey="price" fill="#4CFFA0" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PRICE TREND LINE CHART */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
                padding: "24px",
                borderRadius: "14px",
                border: "1px solid rgba(76, 255, 160, 0.2)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#F1F5F9", fontWeight: 700 }}>
                    📈 {getTranslation(lang, "priceTrend").toUpperCase()}
                  </h3>
                  <span style={{ color: "#64748B", fontSize: "12px" }}>Daily trajectory & spread</span>
                </div>
                <select
                  value={selectedCropTrend}
                  onChange={(e) => setSelectedCropTrend(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(8, 22, 26, 0.6)",
                    border: "1px solid rgba(76, 255, 160, 0.25)",
                    color: "#4CFFA0",
                    borderRadius: "6px",
                    outline: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {Array.from(new Set(data.prices.map((p) => p.crop))).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ height: "320px", width: "100%" }}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(76,255,160,0.1)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(242,247,239,0.4)" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="rgba(242,247,239,0.4)"
                        fontSize={11}
                        tickFormatter={(val) => `₹${val}`}
                        domain={["auto", "auto"]}
                        tickLine={false}
                        label={{ value: "₹/quintal", angle: -90, position: "insideLeft", offset: 10, style: { fill: "rgba(242,247,239,0.5)", fontSize: 10 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(6, 23, 19, 0.95)",
                          border: "1px solid rgba(76,255,160,0.3)",
                          borderRadius: "8px",
                          color: "#F7FBF4",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                        }}
                        formatter={(val: number, name: string) => [
                          `₹${val.toLocaleString("en-IN")}`,
                          name === "price" ? "Modal Price" : name,
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#38BDF8"
                        strokeWidth={3}
                        dot={{ fill: "#38BDF8", r: 4 }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                    No historical trend data available.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MARKET DETAILS TABLE */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid rgba(76, 255, 160, 0.2)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#F1F5F9", fontWeight: 700 }}>
                  🏪 MANDI ARRIVALS & PRICE DETAILS
                </h3>
                <span style={{ color: "#64748B", fontSize: "12px" }}>
                  Showing {filteredPrices.length} records
                </span>
              </div>

              {/* Table search filter */}
              <input
                type="text"
                placeholder="Search crop, mandi, variety..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  background: "rgba(8, 22, 26, 0.6)",
                  border: "1px solid rgba(76, 255, 160, 0.25)",
                  borderRadius: "8px",
                  color: "#F7FBF4",
                  fontSize: "13px",
                  outline: "none",
                  width: "240px",
                }}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(76,255,160,0.15)", color: "rgba(242,247,239,0.6)" }}>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>APMC Mandi</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>District</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Crop</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Variety</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Grade</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Min</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Modal</th>
                    <th style={{ padding: "12px 10px", fontWeight: 600 }}>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.slice(0, 50).map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid rgba(76,255,160,0.08)",
                        color: "#F7FBF4",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(76,255,160,0.08)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 10px", fontWeight: 600, color: "#E2E8F0" }}>{p.market}</td>
                      <td style={{ padding: "12px 10px", color: "rgba(242,247,239,0.5)" }}>{p.district || data.location.district}</td>
                      <td style={{ padding: "12px 10px", color: "#4CFFA0", fontWeight: 600 }}>{p.crop}</td>
                      <td style={{ padding: "12px 10px", color: "#CBD5E1" }}>{p.variety || "Standard"}</td>
                      <td style={{ padding: "12px 10px", color: "#94A3B8" }}>{p.grade || "FAQ"}</td>
                      <td style={{ padding: "12px 10px", color: "#64748B" }}>{p.arrival_date}</td>
                      <td style={{ padding: "12px 10px", color: "#94A3B8" }}>₹{p.min_price.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700, color: "#4ADE80", fontSize: "14px" }}>
                        ₹{p.modal_price.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "12px 10px", color: "#94A3B8" }}>₹{p.max_price.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPrices.length > 50 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#64748B", fontSize: "12px" }}>
                  Showing first 50 records. Use search above to narrow down specific crops.
                </div>
              )}
            </div>
          </div>

          {/* DYNAMIC AGRISAATHI MARKET INSIGHT */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.08) 100%)",
              padding: "20px 24px",
              borderRadius: "12px",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <span style={{ fontSize: "28px" }}>🤖</span>
            <div>
              <div style={{ fontSize: "12px", color: "#22C55E", fontWeight: 700, letterSpacing: "0.5px" }}>
                AGRISAATHI MARKET INTELLIGENCE
              </div>
              <div style={{ color: "#E2E8F0", fontSize: "14px", marginTop: "4px", lineHeight: "1.5" }}>
                In <strong>{data.location.district === "All" ? data.location.state : data.location.district}</strong>,{" "}
                <strong>{stats.highest.crop}</strong> is commanding the highest modal price at{" "}
                <strong style={{ color: "#4ADE80" }}>₹{stats.highest.modal_price.toLocaleString("en-IN")}/quintal</strong> in{" "}
                <strong>{stats.highest.market}</strong>. The regional average across {stats.totalCrops} commodities is ₹
                {Math.round(stats.avg).toLocaleString("en-IN")}/quintal.
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", color: "#64748B", fontSize: "12px", marginTop: "8px" }}>
            Official Data Source: Directorate of Marketing & Inspection (DMI), Agmarknet / data.gov.in • Refreshed Live
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid rgba(76, 255, 160, 0.2)",
        display: "flex",
        flexDirection: "column" as const,
        gap: "6px",
      }}
    >
      <div style={{ color: "#94A3B8", fontSize: "11px", fontWeight: 700, letterSpacing: "1px" }}>{title}</div>
      <div style={{ color, fontSize: "28px", fontWeight: 800, margin: "2px 0" }}>{value}</div>
      <div style={{ color: "#64748B", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {subtitle}
      </div>
    </div>
  );
}
