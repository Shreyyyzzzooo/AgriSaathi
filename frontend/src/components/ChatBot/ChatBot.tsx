import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../../types/api";
import { sendChatMessage } from "../../services/apiClient";
import "./ChatBot.css";

interface ChatBotProps {
  sessionId: string;
}

export function ChatBot({ sessionId }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeakNext, setAutoSpeakNext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stop speaking when chat closes
  useEffect(() => {
    if (!isOpen) window.speechSynthesis.cancel();
  }, [isOpen]);

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Attempt to guess language or default
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN"; // Can be expanded
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setAutoSpeakNext(true); // Automatically speak the next response
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        session_id: sessionId,
        message: userMessage,
        history: messages,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply_text },
      ]);
      if (autoSpeakNext) {
        speakText(response.reply_text);
        setAutoSpeakNext(false);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      {isOpen ? (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h4>AgriTwin Assistant</h4>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
          
          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>Hello! Ask me anything about your crops, budget, or farming advice.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="msg-content">
                  {msg.content}
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => speakText(msg.content)}
                      style={{
                        background: "transparent", border: "none", color: "#94A3B8",
                        cursor: "pointer", marginLeft: 8, padding: 0,
                      }}
                      title="Listen"
                    >
                      🔊
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant">
                <div className="msg-content typing">...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={startListening} 
              style={{ background: isListening ? "#EF4444" : "#475569", padding: "0 12px" }}
              title="Speak"
            >
              🎤
            </button>
            <button onClick={handleSend} disabled={isLoading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <button className="chatbot-toggle" onClick={() => setIsOpen(true)}>
          💬 Chat
        </button>
      )}
    </div>
  );
}
