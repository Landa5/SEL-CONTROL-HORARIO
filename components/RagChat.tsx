"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  source_mode?: string;
}

const MODE_LABELS: Record<string, { icon: string; label: string }> = {
  db:     { icon: "🗃️", label: "Base de datos" },
  docs:   { icon: "📄", label: "Documentos" },
  hybrid: { icon: "🧩", label: "Híbrido" },
  auto:   { icon: "🔄", label: "Automático" },
};

export default function RagChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          provider: "gemini",
          mode: "auto",
          chat_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error("Error en la petición RAG");
      if (!res.body) throw new Error("No body en response");

      setLoading(false); // Quitar "Pensando..." porque ya empezamos a recibir datos
      let botMessageIndex = newMessages.length;
      
      // Añadir mensaje vacío que iremos rellenando
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", source_mode: "auto" }
      ]);
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let streamedText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const dataObj = JSON.parse(dataStr);
                if (dataObj.chunk) {
                  streamedText += dataObj.chunk;
                  // Actualizar React State en tiempo real
                  setMessages((prev) => {
                    const latest = [...prev];
                    latest[botMessageIndex].content = streamedText;
                    return latest;
                  });
                } else if (dataObj.status) {
                  streamedText += `*${dataObj.status}*\n\n`;
                  setMessages((prev) => {
                    const latest = [...prev];
                    latest[botMessageIndex].content = streamedText;
                    return latest;
                  });
                }
              } catch (e) {
                // ignorar json inválido
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ No se pudo conectar con el asistente RAG." },
      ]);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Asistente SEL"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
          fontSize: "24px",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Panel de chat */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "92px",
            right: "24px",
            zIndex: 9998,
            width: "380px",
            maxHeight: "520px",
            display: "flex",
            flexDirection: "column",
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🤖</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
                Asistente SEL
              </div>
              <div style={{ color: "#c4b5fd", fontSize: "0.75rem" }}>
                Datos en tiempo real · Convenio
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{
                  marginLeft: "auto",
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Mensajes */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minHeight: "200px",
              maxHeight: "350px",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#475569",
                  fontSize: "0.85rem",
                  marginTop: "40px",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💬</div>
                Pregunta sobre empleados, jornadas,
                <br />
                ausencias, camiones o el convenio.
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "assistant" && msg.source_mode && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: "#94a3b8",
                      marginBottom: "3px",
                      paddingLeft: "4px",
                    }}
                  >
                    {MODE_LABELS[msg.source_mode]?.icon}{" "}
                    {MODE_LABELS[msg.source_mode]?.label}
                  </span>
                )}
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "10px 14px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#1e293b",
                    color: "#e2e8f0",
                    fontSize: "0.85rem",
                    lineHeight: "1.5",
                    border: msg.role === "assistant" ? "1px solid #334155" : "none",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <div
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "16px 16px 16px 4px",
                    padding: "10px 14px",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}
                >
                  ✦ Pensando...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px 14px",
              borderTop: "1px solid #1e293b",
              display: "flex",
              gap: "8px",
              background: "#0f172a",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Escribe tu pregunta..."
              disabled={loading}
              style={{
                flex: 1,
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "9px 12px",
                color: "#f1f5f9",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? "#1e293b"
                  : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                border: "none",
                borderRadius: "10px",
                padding: "9px 14px",
                color: loading || !input.trim() ? "#475569" : "#fff",
                cursor: loading || !input.trim() ? "default" : "pointer",
                fontSize: "0.9rem",
                transition: "all 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
