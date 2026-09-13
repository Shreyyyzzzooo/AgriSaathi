import { useState, useEffect } from "react";
import { FarmProvider, useFarm } from "./context/FarmContext";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import SimulationPage from "./pages/SimulationPage";
import ChatbotPage from "./pages/ChatbotPage";
import CropPlanPage from "./pages/CropPlanPage";
import MarketPricesPage from "./pages/MarketPricesPage";
import { LanguageModal } from "./components/LanguageModal";

export type RouteType =
  | "landing"
  | "dashboard"
  | "simulation"
  | "chatbot"
  | "crop-plan"
  | "market-prices";

function AppContent() {
  const {
    isAuthenticated,
    login,
    logout,
    lang,
    setLanguage,
    showLanguageModal,
    setShowLanguageModal,
  } = useFarm();

  const getInitialRoute = (): RouteType => {
    const p = window.location.pathname;
    const h = window.location.hash;

    if (h.includes("simulation") || p.startsWith("/simulation")) return "simulation";
    if (h.includes("chatbot") || p.startsWith("/chatbot")) return "chatbot";
    if (h.includes("crop-plan") || p.startsWith("/crop-plan")) return "crop-plan";
    if (h.includes("market-prices") || p.startsWith("/market-prices")) return "market-prices";
    if (h.includes("dashboard") || p.startsWith("/dashboard")) return "dashboard";

    return "landing";
  };

  const [route, setRoute] = useState<RouteType>(getInitialRoute);

  // Sync hash/popstate
  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getInitialRoute());
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = (newRoute: RouteType, path: string) => {
    try {
      window.history.pushState({}, "", path);
    } catch {
      window.location.hash = path;
    }
    setRoute(newRoute);
  };

  // Protected route enforcement: if not authenticated and trying to view app pages, route to landing
  useEffect(() => {
    if (!isAuthenticated && route !== "landing") {
      navigateTo("landing", "/");
    }
  }, [isAuthenticated, route]);

  // Handle successful login
  const handleLoginSuccess = (username: string = "Farmer") => {
    login(username);
    const savedLang = localStorage.getItem("agrisaathi_lang");
    if (!savedLang) {
      // Prompt language modal on first login
      setShowLanguageModal(true);
    } else {
      navigateTo("dashboard", "/#dashboard");
    }
  };

  // Handle language chosen in modal
  const handleLanguageChosen = (chosenLang: typeof lang) => {
    setLanguage(chosenLang);
    setShowLanguageModal(false);
    if (route === "landing") {
      navigateTo("dashboard", "/#dashboard");
    }
  };

  const handleLogout = () => {
    logout();
    navigateTo("landing", "/");
  };

  return (
    <>
      {/* Active Page Routing */}
      {(!isAuthenticated || route === "landing") && (
        <LandingPage
          onLogin={(user) => handleLoginSuccess(user)}
          onExplore={() => handleLoginSuccess("Guest Farmer")}
        />
      )}

      {isAuthenticated && route === "dashboard" && (
        <DashboardPage
          onNavigateSimulation={() => navigateTo("simulation", "/#simulation")}
          onNavigateChatbot={() => navigateTo("chatbot", "/#chatbot")}
          onNavigateCropPlan={() => navigateTo("crop-plan", "/#crop-plan")}
          onNavigateMarket={() => navigateTo("market-prices", "/#market-prices")}
          onLogout={handleLogout}
        />
      )}

      {isAuthenticated && route === "simulation" && (
        <SimulationPage onBack={() => navigateTo("dashboard", "/#dashboard")} />
      )}

      {isAuthenticated && route === "chatbot" && (
        <ChatbotPage onBack={() => navigateTo("dashboard", "/#dashboard")} />
      )}

      {isAuthenticated && route === "crop-plan" && (
        <CropPlanPage
          onBack={() => navigateTo("dashboard", "/#dashboard")}
          onNavigateSimulation={() => navigateTo("simulation", "/#simulation")}
        />
      )}

      {isAuthenticated && route === "market-prices" && (
        <MarketPricesPage onBack={() => navigateTo("dashboard", "/#dashboard")} />
      )}

      {/* Global / Post-Login Language Selection Modal */}
      <LanguageModal
        isOpen={showLanguageModal}
        currentLanguage={lang}
        onSelect={handleLanguageChosen}
        onClose={() => setShowLanguageModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <FarmProvider>
      <AppContent />
    </FarmProvider>
  );
}
