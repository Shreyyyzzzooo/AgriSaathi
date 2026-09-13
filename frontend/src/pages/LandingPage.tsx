import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Sprout, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { useFarm } from "../context/FarmContext";

const NEON = "#4CFFA0";

export interface LandingPageProps {
  onLogin?: (username?: string) => void;
  onExplore?: () => void;
}

export default function LandingPage({ onLogin, onExplore }: LandingPageProps) {
  const { login, register, lang } = useFarm();
  const wordmarkRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [introPhase, setIntroPhase] = useState<"intro" | "settling" | "done">("intro");
  const [flyStyle, setFlyStyle] = useState({ x: 0, y: 0, scale: 1 });
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  // Splash: "AgriSaathi" fills the black screen, holds, then flies/scales
  // down into the wordmark's resting spot — the rest of the page moves in
  // together with it, not before.
  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      setIntroPhase("done");
      return;
    }
    const holdTimer = setTimeout(() => {
      const el = wordmarkRef.current;
      if (!el) {
        setIntroPhase("done");
        return;
      }
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const targetFontPx = parseFloat(cs.fontSize) || 34;
      const introFontPx = 130;
      const vw = window.innerWidth / 2;
      const vh = window.innerHeight / 2;
      setFlyStyle({
        x: rect.left + rect.width / 2 - vw,
        y: rect.top + rect.height / 2 - vh,
        scale: targetFontPx / introFontPx,
      });
      setIntroPhase("settling");
      const settleTimer = setTimeout(() => setIntroPhase("done"), 850);
      return () => clearTimeout(settleTimer);
    }, 950);
    return () => clearTimeout(holdTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setAuthError("Please enter a username.");
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setAuthError("Passwords do not match. Please verify.");
        return;
      }
      if (password.length < 4) {
        setAuthError("Password must be at least 4 characters long.");
        return;
      }

      setIsLoading(true);
      const res = await register(cleanUser, password, lang);
      setIsLoading(false);

      if (!res.success) {
        setAuthError(res.error || "Registration failed. Username may already exist.");
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        if (onLogin) {
          onLogin(cleanUser);
        }
      }, 500);
    } else {
      setIsLoading(true);
      const res = await login(cleanUser, password);
      setIsLoading(false);

      if (!res.success) {
        setAuthError(res.error || "Invalid username or password.");
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        if (onLogin) {
          onLogin(cleanUser);
        }
      }, 500);
    }
  }

  const contentMoved = introPhase !== "intro";

  return (
    <div className="login-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,100..900;1,100..900&display=swap');

        .saira-uniquifier {
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-weight: 400;
          font-style: normal;
          font-variation-settings: "wdth" 100;
        }

        * { box-sizing: border-box; }
        .login-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          background: #04140F;
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-variation-settings: "wdth" 100;
          color: #FFFFFF;
          isolation: isolate;
        }
        .login-root::after {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.05;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          z-index: 5;
        }
        .glow {
          position: absolute;
          left: 50%;
          top: 62%;
          width: 900px;
          height: 500px;
          transform: translate(-50%, -50%);
          background: radial-gradient(closest-side, rgba(76,255,160,0.22), rgba(76,255,160,0));
          pointer-events: none;
          z-index: 1;
        }
        .bg-video {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          z-index: 2;
          pointer-events: none;
        }
        .page-content {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          opacity: ${contentMoved ? 1 : 0};
          transform: ${contentMoved ? "translateY(0)" : "translateY(18px)"};
          transition: opacity 0.85s ease, transform 0.85s cubic-bezier(0.22,0.61,0.36,1);
        }
        .content {
          padding: 32px clamp(24px, 5vw, 72px) 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        header.top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wordmark {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .wordmark span {
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-weight: 700;
          font-style: normal;
          font-variation-settings: "wdth" 100;
          font-size: clamp(32px, 4vw, 44px);
          letter-spacing: -0.01em;
          color: #FFFFFF;
          text-shadow: 0 0 22px rgba(76,255,160,0.35);
        }
        .quick-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(76, 255, 160, 0.12);
          border: 1px solid rgba(76, 255, 160, 0.35);
          color: #A7F3D0;
          padding: 8px 18px;
          border-radius: 9999px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }
        .quick-nav-btn:hover {
          background: rgba(76, 255, 160, 0.22);
          border-color: rgba(76, 255, 160, 0.6);
          color: #FFFFFF;
          transform: translateY(-1px);
        }
        .fly-text {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 60;
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-weight: 700;
          font-style: normal;
          font-variation-settings: "wdth" 100;
          color: #FFFFFF;
          text-align: center;
          white-space: nowrap;
          pointer-events: none;
          text-shadow: 0 0 40px rgba(76,255,160,0.45);
        }
        .scrim {
          position: fixed;
          inset: 0;
          z-index: 55;
          background: #000000;
          transition: opacity 0.85s ease;
          pointer-events: none;
        }
        main.split {
          flex: 1;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: clamp(24px, 5vw, 70px);
          align-items: center;
          padding: 32px 0 60px;
        }
        @media (max-width: 880px) {
          main.split { grid-template-columns: 1fr; padding-top: 24px; }
        }
        .left-col { max-width: 480px; }
        .tagline {
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-weight: 600;
          font-style: normal;
          font-variation-settings: "wdth" 100;
          font-size: clamp(26px, 3.1vw, 38px);
          line-height: 1.22;
          margin: 0 0 20px;
          color: #FFFFFF;
          text-shadow: 0 2px 18px rgba(0,0,0,0.55);
        }
        .body-copy {
          font-size: 16px;
          line-height: 1.65;
          color: #FFFFFF;
          max-width: 42ch;
          text-shadow: 0 2px 14px rgba(0,0,0,0.5);
        }
        .panel {
          background: rgba(6, 20, 15, 0.38);
          backdrop-filter: blur(18px) saturate(120%);
          -webkit-backdrop-filter: blur(18px) saturate(120%);
          border: 1px solid rgba(255,255,255,0.28);
          border-radius: 12px;
          padding: clamp(24px, 3.5vw, 38px);
          box-shadow: 0 30px 80px rgba(4,16,20,0.5);
          max-width: 420px;
          width: 100%;
          justify-self: center;
        }
        .panel h1 {
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-weight: 700;
          font-variation-settings: "wdth" 100;
          font-size: 28px;
          margin: 0 0 6px;
          color: #FFFFFF;
          text-shadow: 0 2px 16px rgba(0,0,0,0.55);
        }
        .panel .sub { font-size: 14px; color: #FFFFFF; margin: 0 0 22px; text-shadow: 0 1px 10px rgba(0,0,0,0.5); }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-size: 13px; margin-bottom: 6px; color: #FFFFFF; text-shadow: 0 1px 10px rgba(0,0,0,0.5); }
        .input-wrap { position: relative; }
        .field input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.35);
          background: rgba(4, 20, 15, 0.3);
          color: #FFFFFF;
          font-size: 14.5px;
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-variation-settings: "wdth" 100;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .field input::placeholder { color: rgba(255,255,255,0.55); }
        .field input:focus {
          border-color: rgba(76,255,160,0.85);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(76,255,160,0.18);
        }
        .eye-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: rgba(255,255,255,0.75); cursor: pointer; display: flex; padding: 4px;
        }
        .eye-btn:hover { color: #FFFFFF; }
        .submit-btn {
          width: 100%;
          margin-top: 8px;
          padding: 13px 16px;
          border-radius: 6px;
          border: 1px solid rgba(76,255,160,0.4);
          background: linear-gradient(135deg, #D2DBCB, #6EDB9B);
          color: #06251A;
          font-family: "Saira", sans-serif;
          font-optical-sizing: auto;
          font-variation-settings: "wdth" 100;
          font-weight: 700;
          font-size: 15.5px;
          letter-spacing: 0.01em;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(10,26,26,0.35), 0 0 24px rgba(76,255,160,0.35), 0 0 0 1px rgba(255,255,255,0.15) inset;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .submit-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 14px 32px rgba(10,26,26,0.45), 0 0 34px rgba(76,255,160,0.5), 0 0 0 1px rgba(255,255,255,0.2) inset;
        }
        .submit-btn:active { transform: translateY(0); }
        .toggle-row { margin-top: 16px; text-align: center; font-size: 13.5px; color: #FFFFFF; text-shadow: 0 1px 10px rgba(0,0,0,0.5); }
        .toggle-row button {
          background: none; border: none; color: ${NEON}; font-size: 13.5px;
          font-family: "Saira", sans-serif; font-optical-sizing: auto; font-variation-settings: "wdth" 100;
          cursor: pointer; text-decoration: underline; text-underline-offset: 3px; padding: 0;
        }
        .guest-bypass-btn {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          background: transparent;
          border: 1px dashed rgba(76, 255, 160, 0.35);
          color: rgba(255, 255, 255, 0.85);
          font-size: 12.5px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .guest-bypass-btn:hover {
          background: rgba(76, 255, 160, 0.1);
          color: #4CFFA0;
          border-color: rgba(76, 255, 160, 0.7);
        }
        .preview-note { margin-top: 14px; font-size: 11.5px; color: rgba(255,255,255,0.75); text-align: center; font-style: italic; }
        .confirm-msg { margin-top: 12px; font-size: 13px; color: ${NEON}; text-align: center; font-weight: 600; }
        footer.ground { position: relative; z-index: 10; margin-top: auto; }
        .foot-line {
          background: transparent;
          padding: 12px clamp(24px, 5vw, 72px) 20px;
          text-align: center;
          font-size: 12.5px;
          color: #FFFFFF;
          text-shadow: 0 1px 10px rgba(0,0,0,0.6);
        }
        @media (prefers-reduced-motion: reduce) {
          .fly-text, .scrim { display: none; }
          .page-content { opacity: 1; transform: none; transition: none; }
        }
      `}</style>

      <div className="glow" />
      <video
        ref={videoRef}
        className="bg-video"
        src="/login-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="page-content">
        <div className="content">
          <header className="top">
            <div className="wordmark" ref={wordmarkRef}>
              <Sprout size={30} color="#4CFFA0" strokeWidth={2} />
              <span>AgriSaathi</span>
            </div>

            {onExplore && (
              <button
                type="button"
                className="quick-nav-btn"
                onClick={onExplore}
                title="Enter directly into the AgriSaathi dashboard"
              >
                <span>Explore Dashboard</span>
                <ArrowRight size={15} />
              </button>
            )}
          </header>

          <main className="split">
            <div className="left-col">
              <h1 className="tagline">Smarter decisions. Healthier fields. Better harvests.</h1>
              <p className="body-copy">
                Your field changes every day. AgriSaathi helps you understand what’s happening
                beneath the surface — from crop growth and weather to market prices, risk, and expected
                returns.
              </p>
            </div>

            <form className="panel" onSubmit={handleSubmit}>
              {mode === "login" ? (
                <>
                  <h1>Welcome</h1>
                  <p className="sub">Log in to check on things.</p>
                </>
              ) : (
                <>
                  <h1>Let's get growing</h1>
                  <p className="sub">Set up your field in a minute.</p>
                </>
              )}

              {authError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                    color: "#FCA5A5",
                    fontSize: "13px",
                    lineHeight: "1.4",
                  }}
                >
                  <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
                  <span>{authError}</span>
                </div>
              )}

              {mode === "register" && (
                <div className="field">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                  />
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
              </button>

              <div className="toggle-row">
                {mode === "login" ? (
                  <>
                    New here?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setAuthError(null);
                      }}
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already growing with us?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setAuthError(null);
                      }}
                    >
                      Log in
                    </button>
                  </>
                )}
              </div>

              {onExplore && (
                <button
                  type="button"
                  className="guest-bypass-btn"
                  onClick={onExplore}
                >
                  <span>Continue as Guest / View Twin</span>
                  <ArrowRight size={14} />
                </button>
              )}

              <p className="preview-note">This is a design preview — logging in opens your digital twin workspace.</p>
              {submitted && <p className="confirm-msg">✓ Logging in as {username || "Farmer"}...</p>}
            </form>
          </main>
        </div>

        <footer className="ground">
          <div className="foot-line">
            AgriSaathi — Smarter decisions. Healthier fields. Better harvests.
          </div>
        </footer>
      </div>

      {introPhase !== "done" && (
        <>
          <div className="scrim" style={{ opacity: introPhase === "settling" ? 0 : 1 }} />
          <div
            className="fly-text"
            style={{
              fontSize: "130px",
              transform: `translate(-50%, -50%) translate(${flyStyle.x}px, ${flyStyle.y}px) scale(${flyStyle.scale})`,
              opacity: introPhase === "settling" ? 0 : 1,
              transition:
                introPhase === "settling"
                  ? "transform 0.85s cubic-bezier(0.22,0.61,0.36,1), opacity 0.85s ease 0.3s"
                  : "none",
            }}
          >
            AgriSaathi
          </div>
        </>
      )}
    </div>
  );
}
