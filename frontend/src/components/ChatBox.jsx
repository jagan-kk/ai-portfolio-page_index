import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatBox() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! Ask me anything about the document.", sender: "bot" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now(), text: input, sender: "user" };
    const botMessageId = Date.now() + 1;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
        const BACKEND_URL = import.meta.env.VITE_API_URL || "https://ai-portfolio-page-index.onrender.com";
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.text }),
      });

      if (!response.ok) {
        throw new Error("Server responded with an error status.");
      }

      setMessages((prev) => [...prev, { id: botMessageId, text: "", sender: "bot" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, text: msg.text + chunk } : msg
            )
          );
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), text: "Failed to connect or stream from the backend server.", sender: "bot" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.messagesWindow}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ ...styles.messageWrapper, justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...styles.messageBubble, ...(msg.sender === 'user' ? styles.userBubble : styles.botBubble) }}>
              {msg.sender === 'bot' ? (
                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.text}</Markdown>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <form onSubmit={handleSendMessage} style={styles.inputPill}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder=""
            style={styles.inputField}
            disabled={isLoading}
          />

          <button type="submit" style={{ ...styles.sendButton, opacity: input.trim() && !isLoading ? 1 : 0.4 }} disabled={!input.trim() || isLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }) => <h1 style={styles.h1}>{children}</h1>,
  h2: ({ children }) => <h2 style={styles.h2}>{children}</h2>,
  h3: ({ children }) => <h3 style={styles.h3}>{children}</h3>,
  ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
  ol: ({ children }) => <ol style={styles.ol}>{children}</ol>,
  li: ({ children }) => <li style={styles.li}>{children}</li>,
  p: ({ children }) => <p style={styles.p}>{children}</p>,
  code: ({ children }) => <code style={styles.code}>{children}</code>,
  strong: ({ children }) => <strong style={styles.strong}>{children}</strong>,
  em: ({ children }) => <em style={styles.em}>{children}</em>,
};

const styles = {
  chatContainer: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', height: '100vh', background: '#0d0d0d' },
  messagesWindow: { flex: 1, padding: '40px 20px 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' },
  messageWrapper: { display: 'flex', width: '100%' },
  messageBubble: { maxWidth: '70%', padding: '12px 18px', borderRadius: '1.5rem', fontSize: '1rem', lineHeight: '1.5' },
  userBubble: { background: '#2f2f2f', color: '#ececec' },
  botBubble: { background: 'transparent', color: '#b4b4b4', paddingLeft: 0, maxWidth: '85%' },
  inputContainer: { padding: '0 20px 24px 20px', background: '#0d0d0d', display: 'flex', justifyContent: 'center' },
  inputPill: { display: 'flex', alignItems: 'center', width: '100%', maxWidth: '720px', background: '#212121', borderRadius: '9999px', padding: '8px 12px 8px 16px', gap: '12px', boxSizing: 'border-box' },
  inputField: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#ececec', fontSize: '1.05rem', fontFamily: 'inherit', padding: '6px 0' },
  iconButton: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  sendButton: { background: '#ffffff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s ease' },
  h1: { fontSize: '1.5rem', fontWeight: 700, color: '#ececec', margin: '16px 0 8px 0', lineHeight: 1.3 },
  h2: { fontSize: '1.25rem', fontWeight: 700, color: '#ececec', margin: '14px 0 6px 0', lineHeight: 1.3 },
  h3: { fontSize: '1.1rem', fontWeight: 600, color: '#ececec', margin: '12px 0 4px 0', lineHeight: 1.3 },
  ul: { margin: '6px 0', paddingLeft: '24px', listStyleType: 'disc' },
  ol: { margin: '6px 0', paddingLeft: '24px' },
  li: { margin: '4px 0', lineHeight: 1.6 },
  p: { margin: '8px 0', lineHeight: 1.6 },
  code: { background: '#1a1a1a', color: '#e6db74', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' },
  strong: { color: '#ececec', fontWeight: 700 },
  em: { color: '#ececec', fontStyle: 'italic' },
};
