import React, { useState } from "react";
import { Globe, Check } from "lucide-react";
import { type Language } from "../i18n";

interface LanguageModalProps {
  isOpen: boolean;
  currentLanguage: Language;
  onSelect: (lang: Language) => void;
  onClose?: () => void;
}

interface LangOption {
  key: Language;
  title: string;
  subtitle: string;
  flag: string;
}

const OPTIONS: LangOption[] = [
  { key: "en", title: "English", subtitle: "Default interface language", flag: "🇬🇧" },
  { key: "hi", title: "हिंदी", subtitle: "Hindi — हिंदी भाषा में संपूर्ण सहायता", flag: "🇮🇳" },
  { key: "mr", title: "मराठी", subtitle: "Marathi — महाराष्ट्र", flag: "🇮🇳" },
  { key: "bn", title: "বাংলা", subtitle: "Bengali — পশ্চিমবঙ্গ", flag: "🇮🇳" },
  { key: "ta", title: "தமிழ்", subtitle: "Tamil — தமிழ்நாடு", flag: "🇮🇳" },
  { key: "te", title: "తెలుగు", subtitle: "Telugu — ఆంధ్రప్రదేశ్", flag: "🇮🇳" },
  { key: "gu", title: "ગુજરાતી", subtitle: "Gujarati — ગુજરાત", flag: "🇮🇳" },
  { key: "kn", title: "ಕನ್ನಡ", subtitle: "Kannada — ಕರ್ನಾಟಕ", flag: "🇮🇳" },
  { key: "pa", title: "ਪੰਜਾਬੀ", subtitle: "Punjabi — ਪੰਜਾਬ", flag: "🇮🇳" },
  { key: "ml", title: "മലയാളം", subtitle: "Malayalam — കേരളം", flag: "🇮🇳" },
];

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  currentLanguage,
  onSelect,
  onClose,
}) => {
  const [selected, setSelected] = useState<Language>(() => {
    return currentLanguage || "en";
  });

  if (!isOpen) return null;

  const handleContinue = () => {
    onSelect(selected);
  };

  return (
    <div
      className="lang-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <style>{`
        .lang-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(4, 20, 15, 0.78);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.25s ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        .lang-modal-card {
          position: relative;
          background: rgba(10, 34, 26, 0.88);
          border: 1px solid rgba(76, 255, 160, 0.32);
          backdrop-filter: blur(24px) saturate(120%);
          border-radius: 16px;
          padding: clamp(24px, 3vw, 32px);
          max-width: 500px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.6), 0 0 50px rgba(76, 255, 160, 0.12);
          text-align: center;
          color: #F7FBF4;
        }

        .lang-modal-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }

        .lang-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(76, 255, 160, 0.12);
          border: 1px solid rgba(76, 255, 160, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4CFFA0;
          margin-bottom: 14px;
          box-shadow: 0 0 20px rgba(76, 255, 160, 0.2);
        }

        .lang-modal-title {
          font-size: 22px;
          font-weight: 700;
          color: #FBFFFC;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .lang-modal-sub {
          font-size: 13px;
          color: rgba(242, 247, 239, 0.72);
          margin: 0;
          line-height: 1.4;
        }

        .lang-options-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 20px;
        }

        .lang-option-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(76, 255, 160, 0.2);
          background: rgba(8, 22, 26, 0.45);
          color: #F7FBF4;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
        }

        .lang-option-btn:hover {
          background: rgba(76, 255, 160, 0.1);
          border-color: rgba(76, 255, 160, 0.45);
          transform: translateY(-1px);
        }

        .lang-option-btn.selected {
          background: rgba(76, 255, 160, 0.18);
          border-color: #4CFFA0;
          box-shadow: 0 0 16px rgba(76, 255, 160, 0.25);
        }

        .lang-opt-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lang-opt-flag {
          font-size: 18px;
          line-height: 1;
        }

        .lang-opt-title {
          font-size: 14px;
          font-weight: 700;
          color: #FBFFFC;
          margin-bottom: 1px;
        }

        .lang-opt-sub {
          font-size: 10px;
          color: rgba(242, 247, 239, 0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 110px;
        }

        .lang-check-badge {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #4CFFA0;
          color: #06251A;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .lang-submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 8px;
          border: 1px solid rgba(76, 255, 160, 0.4);
          background: linear-gradient(135deg, #D2DBCB, #6EDB9B);
          color: #06251A;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(10, 26, 26, 0.35), 0 0 20px rgba(76, 255, 160, 0.35);
          transition: all 0.2s ease;
        }

        .lang-submit-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 14px 30px rgba(10, 26, 26, 0.45), 0 0 30px rgba(76, 255, 160, 0.5);
        }
      `}</style>

      <div className="lang-modal-card">
        <div className="lang-modal-header">
          <div className="lang-icon-wrapper">
            <Globe size={26} />
          </div>
          <h2 className="lang-modal-title">Choose Language</h2>
          <p className="lang-modal-sub">
            How would you like AgriSaathi to communicate with you?
          </p>
        </div>

        <div className="lang-options-list" role="radiogroup">
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={`lang-option-btn ${isSelected ? "selected" : ""}`}
                onClick={() => setSelected(opt.key)}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="lang-opt-row">
                  <span className="lang-opt-flag">{opt.flag}</span>
                  <div>
                    <div className="lang-opt-title">{opt.title}</div>
                    <div className="lang-opt-sub">{opt.subtitle}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="lang-check-badge">
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="lang-submit-btn"
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
