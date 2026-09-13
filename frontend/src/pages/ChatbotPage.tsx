import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Send,
  Volume2,
  Sparkles,
  Sprout,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import {
  createChatConversation,
  deleteChatConversation,
  fetchChatConversationDetail,
  fetchChatConversations,
  postChatMessage,
} from "../services/apiClient";
import { useFarm } from "../context/FarmContext";
import { getTranslation } from "../i18n";
import type { ChatConversationItem, ChatMessageItem } from "../types/api";

interface ChatbotPageProps {
  onBack: () => void;
}

const SUGGESTED_QUESTIONS = [
  "🌾 Which crop has the highest expected return for my field?",
  "💧 How should I manage water if rainfall drops below normal?",
  "⚡ Explain the peer saturation and market crash risk warning.",
  "🌱 What fertilizers are recommended for my soil type?",
];

export default function ChatbotPage({ onBack }: ChatbotPageProps) {
  const { session, farmerInput, farmerProfile, lang, isAuthenticated, user } = useFarm();
  const sessionId = session?.session_id || "sess_demo_default";

  const activeLocation =
    farmerInput?.location ||
    farmerProfile?.location ||
    (farmerProfile?.district
      ? `${farmerProfile.district}${farmerProfile.state ? ", " + farmerProfile.state : ""}`
      : "Nashik, Maharashtra");

  const defaultGreeting: ChatMessageItem = {
    id: "welcome-greeting",
    conversation_id: "none",
    sender: "bot",
    text: `Hello ${user?.username || "Farmer"}! I am your AgriSaathi AI agronomic advisor. I am tuned to your field in ${
      activeLocation
    } with ${farmerInput?.soil_type || "black"} soil and ${
      farmerInput?.plot_size_ha || 2.5
    } hectares. How can I assist your crop planning today?`,
    created_at: new Date().toISOString(),
  };

  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([defaultGreeting]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages((prev) => {
        if (prev.length <= 1 && prev[0]?.id === "welcome-greeting") {
          return [
            {
              ...prev[0],
              text: `Hello ${user?.username || "Farmer"}! I am your AgriSaathi AI agronomic advisor. I am tuned to your field in ${
                activeLocation
              } with ${farmerInput?.soil_type || "black"} soil and ${
                farmerInput?.plot_size_ha || 2.5
              } hectares. How can I assist your crop planning today?`,
            },
          ];
        }
        return prev;
      });
    }
  }, [activeLocation, farmerInput?.soil_type, farmerInput?.plot_size_ha, user?.username, activeConvId]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Load conversation list on mount if authenticated
  const loadConversations = useCallback(async (selectFirst = false) => {
    if (!isAuthenticated) return;
    setIsLoadingList(true);
    try {
      const list = await fetchChatConversations();
      setConversations(list);
      if (selectFirst && list.length > 0) {
        selectConversation(list[0].id);
      }
    } catch (e) {
      console.warn("Could not load chat conversations", e);
    } finally {
      setIsLoadingList(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    window.speechSynthesis.cancel();
    setSpeakingIdx(null);
    try {
      const detail = await fetchChatConversationDetail(convId);
      if (detail.messages.length > 0) {
        setMessages(detail.messages);
      } else {
        setMessages([defaultGreeting]);
      }
    } catch (err) {
      console.error("Failed to load conversation detail", err);
    }
  };

  const handleStartNewChat = () => {
    window.speechSynthesis.cancel();
    setSpeakingIdx(null);
    setActiveConvId(null);
    setMessages([defaultGreeting]);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await deleteChatConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const speakText = (text: string, idx: number) => {
    window.speechSynthesis.cancel();
    if (speakingIdx === idx) {
      setSpeakingIdx(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSend = async (customMessage?: string) => {
    const userMessage = (customMessage || input).trim();
    if (!userMessage || isLoading) return;

    setInput("");

    // Optimistically add user message to UI
    const tempUserMsg: ChatMessageItem = {
      id: "temp-user-" + Date.now(),
      conversation_id: activeConvId || "pending",
      sender: "user",
      text: userMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      let targetConvId = activeConvId;

      // 1. If no active conversation, create one
      if (!targetConvId && isAuthenticated) {
        const title = userMessage.length > 35 ? userMessage.slice(0, 35) + "..." : userMessage;
        const newConv = await createChatConversation(title);
        targetConvId = newConv.id;
        setActiveConvId(targetConvId);
      }

      // 2. Post message to conversation
      if (targetConvId) {
        const botReply = await postChatMessage(targetConvId, userMessage, sessionId);
        setMessages((prev) => [...prev, botReply]);
        // Refresh conversations list to update titles/timestamps
        loadConversations();
      } else {
        // Fallback for unauthenticated/demo
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now(),
            conversation_id: "demo",
            sender: "bot",
            text: "Here is guidance based on your field inputs. To save conversation history permanently, please sign in with an AgriSaathi account.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          conversation_id: activeConvId || "err",
          sender: "bot",
          text: "I encountered an error connecting to AgriSaathi services. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "linear-gradient(180deg, #04140F 0%, #0A2A1E 26%, #123D2A 50%, #061713 100%)",
      display: "flex",
      flexDirection: "column",
      color: "#F7FBF4",
    }}>
      <PageHeader
        title={`💬 ${getTranslation(lang, "chatTitle")}`}
        subtitle={getTranslation(lang, "chatSubtitle")}
        onBack={onBack}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setIsSidebarOpen((s) => !s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(76, 255, 160, 0.12)",
                border: "1px solid rgba(76, 255, 160, 0.3)",
                borderRadius: "8px",
                padding: "6px 12px",
                color: "#4CFFA0",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
              title="Toggle Conversations Sidebar"
            >
              {isSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              <span>{isSidebarOpen ? "Hide History" : "History"}</span>
            </button>

            <Badge variant="green">
              📍 {activeLocation}
            </Badge>
          </div>
        }
      />

      {/* Main Chat Layout (Sidebar + Chat Area) */}
      <div style={{
        flex: 1,
        maxWidth: "1280px",
        width: "100%",
        margin: "0 auto",
        padding: "16px clamp(12px, 3vw, 24px) 24px",
        display: "flex",
        gap: 20,
        height: "calc(100vh - 90px)",
      }}>
        {/* Left History Sidebar */}
        {isSidebarOpen && (
          <aside style={{
            width: "280px",
            flexShrink: 0,
            background: "rgba(10, 34, 26, 0.75)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(76, 255, 160, 0.2)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}>
            {/* New Chat Button */}
            <div style={{ padding: "14px", borderBottom: "1px solid rgba(76, 255, 160, 0.15)" }}>
              <button
                onClick={handleStartNewChat}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(76, 255, 160, 0.4)",
                  background: "linear-gradient(135deg, rgba(76, 255, 160, 0.2), rgba(39, 107, 70, 0.35))",
                  color: "#FBFFFC",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(76, 255, 160, 0.3), rgba(39, 107, 70, 0.5))";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(76, 255, 160, 0.2), rgba(39, 107, 70, 0.35))";
                }}
              >
                <Plus size={16} color="#4CFFA0" />
                <span>+ New Conversation</span>
              </button>
            </div>

            {/* Conversation List */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}>
              {isLoadingList && conversations.length === 0 && (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: "12px", color: "rgba(242, 247, 239, 0.6)" }}>
                  Loading history...
                </div>
              )}

              {!isLoadingList && conversations.length === 0 && (
                <div style={{ padding: "24px 12px", textAlign: "center", fontSize: "12.5px", color: "rgba(242, 247, 239, 0.6)" }}>
                  No saved conversations yet. Ask a question to start one!
                </div>
              )}

              {conversations.map((c) => {
                const isActive = activeConvId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: isActive ? "rgba(76, 255, 160, 0.18)" : "transparent",
                      border: `1px solid ${isActive ? "rgba(76, 255, 160, 0.4)" : "transparent"}`,
                      color: isActive ? "#FBFFFC" : "rgba(242, 247, 239, 0.8)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) e.currentTarget.style.background = "rgba(76, 255, 160, 0.08)";
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                      <MessageSquare size={14} color={isActive ? "#4CFFA0" : "#A7F3D0"} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: "13px",
                        fontWeight: isActive ? 700 : 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "170px",
                      }}>
                        {c.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(242, 247, 239, 0.4)",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        borderRadius: "4px",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "#EF4444";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "rgba(242, 247, 239, 0.4)";
                      }}
                      title="Delete conversation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Right Main Chat Column */}
        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 0,
        }}>
          {/* Suggested Prompts */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "10px 14px",
            background: "rgba(10, 34, 26, 0.5)",
            borderRadius: 12,
            border: "1px solid rgba(76, 255, 160, 0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4CFFA0", fontSize: "12px", fontWeight: 700 }}>
              <Sparkles size={14} />
              <span>Suggested:</span>
            </div>
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                style={{
                  background: "rgba(76, 255, 160, 0.08)",
                  border: "1px solid rgba(76, 255, 160, 0.25)",
                  borderRadius: "20px",
                  padding: "4px 10px",
                  color: "rgba(242, 247, 239, 0.88)",
                  fontSize: "11.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(76, 255, 160, 0.2)";
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(76, 255, 160, 0.08)";
                  e.currentTarget.style.color = "rgba(242, 247, 239, 0.88)";
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Message Thread Box */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            background: "rgba(10, 34, 26, 0.65)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(76, 255, 160, 0.2)",
            borderRadius: 14,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            {messages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id || idx}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {!isUser && (
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "rgba(76, 255, 160, 0.15)",
                      border: "1px solid rgba(76, 255, 160, 0.4)",
                      color: "#4CFFA0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Sprout size={18} />
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "12px 18px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isUser
                        ? "linear-gradient(135deg, rgba(76, 255, 160, 0.25), rgba(30, 90, 60, 0.4))"
                        : "rgba(8, 22, 26, 0.75)",
                      border: isUser
                        ? "1px solid rgba(76, 255, 160, 0.4)"
                        : "1px solid rgba(76, 255, 160, 0.18)",
                      color: isUser ? "#FBFFFC" : "rgba(242, 247, 239, 0.94)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                      position: "relative",
                    }}
                  >
                    <div>{msg.text}</div>

                    {!isUser && (
                      <button
                        onClick={() => speakText(msg.text, idx)}
                        style={{
                          marginTop: 8,
                          background: "none",
                          border: "none",
                          color: speakingIdx === idx ? "#4CFFA0" : "rgba(242, 247, 239, 0.6)",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: 0,
                        }}
                        title="Read aloud"
                      >
                        <Volume2 size={15} />
                        <span>{speakingIdx === idx ? "Speaking..." : "Listen"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(76, 255, 160, 0.15)",
                  color: "#4CFFA0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Sprout size={16} />
                </div>
                <div style={{
                  background: "rgba(8, 22, 26, 0.6)",
                  border: "1px solid rgba(76, 255, 160, 0.15)",
                  borderRadius: "12px",
                  padding: "10px 16px",
                  color: "#4CFFA0",
                  fontSize: "13px",
                  fontStyle: "italic",
                }}>
                  AgriSaathi is consulting agronomy models and weather telemetry...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div style={{
            display: "flex",
            gap: 10,
            background: "rgba(10, 34, 26, 0.8)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(76, 255, 160, 0.25)",
            borderRadius: 12,
            padding: "8px 12px",
            alignItems: "center",
          }}>
            <input
              type="text"
              placeholder={getTranslation(lang, "typeMessage")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "#FBFFFC",
                fontSize: "14.5px",
                outline: "none",
                padding: "8px",
              }}
            />

            <button
              type="button"
              onClick={startListening}
              style={{
                width: 40,
                height: 40,
                borderRadius: "8px",
                background: isListening ? "#EF4444" : "rgba(76, 255, 160, 0.15)",
                border: `1px solid ${isListening ? "#EF4444" : "rgba(76, 255, 160, 0.3)"}`,
                color: isListening ? "#FFFFFF" : "#4CFFA0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title={isListening ? "Listening... click to stop" : "Speak question"}
            >
              <Mic size={18} />
            </button>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid rgba(76, 255, 160, 0.4)",
                background: "linear-gradient(135deg, #D2DBCB, #6EDB9B)",
                color: "#06251A",
                fontWeight: 700,
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                opacity: isLoading || !input.trim() ? 0.6 : 1,
                transition: "all 0.2s",
              }}
            >
              <span>{getTranslation(lang, "send")}</span>
              <Send size={15} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
