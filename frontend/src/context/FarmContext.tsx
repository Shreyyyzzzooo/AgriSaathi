import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  FarmerRequest,
  FarmerResponse,
  CropCandidate,
  CropResult,
  FarmerProfile,
  ExplainResponse,
} from "../types/api";
import { type Language } from "../i18n";
import {
  fetchCurrentUser,
  fetchFarmerProfile,
  loginUser,
  logoutUser,
  registerUser,
  updateFarmerProfile,
  updateUserLanguage,
  extractErrorMessage,
} from "../services/apiClient";

export interface UserProfile {
  id?: string;
  username: string;
  preferred_language?: string;
  created_at?: string;
}

export interface FarmContextType {
  user: UserProfile | null;
  farmerProfile: FarmerProfile | null;
  setFarmerProfile: (profile: FarmerProfile | null) => void;
  isAuthenticated: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, preferred_language?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  reloadFarmerProfile: () => Promise<FarmerProfile | null>;
  saveFarmerProfile: (profile: Partial<FarmerProfile>) => Promise<boolean>;

  lang: Language;
  setLanguage: (l: Language) => void;
  showLanguageModal: boolean;
  setShowLanguageModal: (show: boolean) => void;

  farmerInput: FarmerRequest | null;
  setFarmerInput: (input: FarmerRequest | null) => void;
  session: FarmerResponse | null;
  setSession: (sess: FarmerResponse | null) => void;
  crops: CropCandidate[];
  setCrops: (crops: CropCandidate[]) => void;
  simResults: Record<string, CropResult & { market_crash_risk?: boolean }>;
  setSimResults: (results: Record<string, CropResult & { market_crash_risk?: boolean }>) => void;
  activeCrop: CropResult | null;
  setActiveCrop: (crop: CropResult | null) => void;

  updateFarmSetup: (sess: FarmerResponse, candidates: CropCandidate[], input: FarmerRequest) => void;
  aiExplanation: { cropId: string; explanation: ExplainResponse } | null;
  setAiExplanation: (exp: { cropId: string; explanation: ExplainResponse } | null) => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

// Initial default farm profile for immediate interactive preview
const DEFAULT_FARMER_INPUT: FarmerRequest = {
  location: "Nashik, Maharashtra",
  plot_size_ha: 2.5,
  soil_type: "clay",
  water_availability: "irrigated",
  budget_inr: 120000,
};

const DEFAULT_CROPS: CropCandidate[] = [
  {
    crop_id: "wheat_rabi",
    name: "Wheat (गेहूं)",
    season: "rabi",
    duration_days: 120,
    budget_flag: "within_budget",
  },
  {
    crop_id: "cotton_kharif",
    name: "Cotton (कपास)",
    season: "kharif",
    duration_days: 160,
    budget_flag: "within_budget",
  },
  {
    crop_id: "soybean_kharif",
    name: "Soybean (सोयाबीन)",
    season: "kharif",
    duration_days: 100,
    budget_flag: "within_budget",
  },
  {
    crop_id: "groundnut_kharif",
    name: "Groundnut (मूंगफली)",
    season: "kharif",
    duration_days: 115,
    budget_flag: "within_budget",
  },
];

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication state
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_farmer_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Language state
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_lang");
      return (saved as Language) || "en";
    } catch {
      return "en";
    }
  });

  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  // Farm state
  const [farmerInput, setFarmerInput] = useState<FarmerRequest | null>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_input");
      return saved ? JSON.parse(saved) : DEFAULT_FARMER_INPUT;
    } catch {
      return DEFAULT_FARMER_INPUT;
    }
  });

  const [session, setSession] = useState<FarmerResponse | null>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_session");
      return saved ? JSON.parse(saved) : {
        session_id: "sess_demo_default",
        status: "active",
      };
    } catch {
      return null;
    }
  });

  const [crops, setCrops] = useState<CropCandidate[]>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_crops");
      return saved ? JSON.parse(saved) : DEFAULT_CROPS;
    } catch {
      return DEFAULT_CROPS;
    }
  });

  const [simResults, setSimResults] = useState<Record<string, CropResult & { market_crash_risk?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem("agrisaathi_sim_results");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [activeCrop, setActiveCrop] = useState<CropResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState<{ cropId: string; explanation: ExplainResponse } | null>(null);

  // Helper to apply a loaded profile to farmerInput
  const applyProfileToFarmerInput = useCallback((prof: FarmerProfile) => {
    setFarmerProfile(prof);
    try {
      localStorage.setItem("agrisaathi_farmer_profile", JSON.stringify(prof));
    } catch (e) {
      console.warn("Storage error", e);
    }

    const loc =
      prof.location ||
      (prof.district
        ? `${prof.district}${prof.state ? ", " + prof.state : ""}`
        : prof.farm_name) ||
      "Nashik, Maharashtra";

    const plotHa = prof.area_acres
      ? +(prof.area_acres / 2.47105).toFixed(2)
      : 2.5;

    const newInput: FarmerRequest = {
      location: loc,
      plot_size_ha: plotHa,
      soil_type: (prof.soil_type as any) || "clay",
      water_availability: (prof.irrigation_type as any) || "irrigated",
      budget_inr: prof.budget_inr || 120000,
    };
    setFarmerInput(newInput);
    try {
      localStorage.setItem("agrisaathi_input", JSON.stringify(newInput));
    } catch (e) {
      console.warn("Storage error", e);
    }
  }, []);

  // Reload profile on demand
  const reloadFarmerProfile = useCallback(async (): Promise<FarmerProfile | null> => {
    const token = localStorage.getItem("agrisaathi_token");
    if (!token) return null;
    try {
      const res = await fetchFarmerProfile();
      if (res && res.profile) {
        applyProfileToFarmerInput(res.profile);
        return res.profile;
      }
      return null;
    } catch (e) {
      console.warn("Error reloading farmer profile", e);
      return null;
    }
  }, [applyProfileToFarmerInput]);

  // Check auth and hydrate profile on startup
  useEffect(() => {
    const token = localStorage.getItem("agrisaathi_token");
    if (!token) return;

    fetchCurrentUser()
      .then((currUser) => {
        setUser(currUser);
        try {
          localStorage.setItem("agrisaathi_user", JSON.stringify(currUser));
        } catch (e) {
          console.warn("Storage error", e);
        }
        if (currUser.preferred_language) {
          setLangState(currUser.preferred_language as Language);
        }
        // Fetch farmer profile
        reloadFarmerProfile();
      })
      .catch(() => {
        // Invalid or expired token
        localStorage.removeItem("agrisaathi_token");
        localStorage.removeItem("agrisaathi_user");
        localStorage.removeItem("agrisaathi_farmer_profile");
        setUser(null);
        setFarmerProfile(null);
      });
  }, [reloadFarmerProfile]);

  const login = async (username: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (password) {
        const resp = await loginUser({ username, password });
        localStorage.setItem("agrisaathi_token", resp.token);
        setUser(resp.user);
        localStorage.setItem("agrisaathi_user", JSON.stringify(resp.user));
        if (resp.user.preferred_language) {
          setLangState(resp.user.preferred_language as Language);
        }
        await reloadFarmerProfile();
        return { success: true };
      } else {
        // Fallback for demo username-only
        const profile = { username: username || "Farmer" };
        setUser(profile);
        localStorage.setItem("agrisaathi_user", JSON.stringify(profile));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: extractErrorMessage(err) };
    }
  };

  const register = async (
    username: string,
    password: string,
    preferred_language: string = "en"
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const resp = await registerUser({ username, password, preferred_language });
      localStorage.setItem("agrisaathi_token", resp.token);
      setUser(resp.user);
      localStorage.setItem("agrisaathi_user", JSON.stringify(resp.user));
      setLangState(resp.user.preferred_language as Language);
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err) };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    }
    localStorage.removeItem("agrisaathi_token");
    localStorage.removeItem("agrisaathi_user");
    localStorage.removeItem("agrisaathi_farmer_profile");
    setUser(null);
    setFarmerProfile(null);
  };

  const saveFarmerProfile = async (profileData: Partial<FarmerProfile>): Promise<boolean> => {
    try {
      const res = await updateFarmerProfile(profileData);
      if (res && res.profile) {
        applyProfileToFarmerInput(res.profile);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update profile", err);
      return false;
    }
  };

  const setLanguage = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("agrisaathi_lang", newLang);
    } catch (e) {
      console.warn("Storage error", e);
    }
    const token = localStorage.getItem("agrisaathi_token");
    if (token) {
      updateUserLanguage(newLang).catch(() => {});
    }
  };

  const updateFarmSetup = (sess: FarmerResponse, candidates: CropCandidate[], input: FarmerRequest) => {
    setSession(sess);
    setCrops(candidates);
    setFarmerInput(input);

    const parts = (input.location || "").split(",").map((p) => p.trim()).filter(Boolean);
    const updatedProfile: FarmerProfile = {
      ...(farmerProfile || {}),
      location: input.location,
      district: parts[0] || farmerProfile?.district || input.location,
      state: parts[1] || farmerProfile?.state,
      soil_type: input.soil_type,
      irrigation_type: input.water_availability,
      budget_inr: input.budget_inr,
      area_acres: +(input.plot_size_ha * 2.47105).toFixed(2),
    };
    setFarmerProfile(updatedProfile);

    try {
      localStorage.setItem("agrisaathi_session", JSON.stringify(sess));
      localStorage.setItem("agrisaathi_crops", JSON.stringify(candidates));
      localStorage.setItem("agrisaathi_input", JSON.stringify(input));
      localStorage.setItem("agrisaathi_farmer_profile", JSON.stringify(updatedProfile));
    } catch (e) {
      console.warn("Storage error", e);
    }
  };

  // Sync simResults to localStorage
  useEffect(() => {
    if (Object.keys(simResults).length > 0) {
      try {
        localStorage.setItem("agrisaathi_sim_results", JSON.stringify(simResults));
      } catch (e) {
        console.warn("Storage error", e);
      }
    }
  }, [simResults]);

  return (
    <FarmContext.Provider
      value={{
        user,
        farmerProfile,
        setFarmerProfile,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        reloadFarmerProfile,
        saveFarmerProfile,
        lang,
        setLanguage,
        showLanguageModal,
        setShowLanguageModal,
        farmerInput,
        setFarmerInput,
        session,
        setSession,
        crops,
        setCrops,
        simResults,
        setSimResults,
        activeCrop,
        setActiveCrop,
        updateFarmSetup,
        aiExplanation,
        setAiExplanation,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export function useFarm(): FarmContextType {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
}
