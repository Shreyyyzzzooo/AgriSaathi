import { MarketPriceDashboard } from "../components/MarketPrices/MarketPriceDashboard";
import { PageHeader, Badge } from "../components/ui";
import { useFarm } from "../context/FarmContext";
import { getTranslation } from "../i18n";

interface MarketPricesPageProps {
  onBack: () => void;
}

export default function MarketPricesPage({ onBack }: MarketPricesPageProps) {
  const { lang } = useFarm();
  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      color: "#F7FBF4",
    }}>
      <PageHeader
        title={`📈 ${getTranslation(lang, "marketPrices")}`}
        subtitle="Real-time commodity prices and historical trends from Agmarknet across mandis in India"
        onBack={onBack}
        actions={
          <Badge variant="green">
            Live Agmarknet Data
          </Badge>
        }
      />

      <main style={{ padding: "28px clamp(16px, 4vw, 40px)", maxWidth: "1300px", width: "100%", margin: "0 auto" }}>
        <MarketPriceDashboard />
      </main>
    </div>
  );
}
