import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Sparkles, Send, Bot, User } from "lucide-react";

export default function AIAssistant() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hola, soy Rura, tu asistente del campo. Pregúntame sobre cultivos, salud animal, sostenibilidad o cómo vender tus productos." },
    ]);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const scroller = useRef(null);

    useEffect(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    if (!user) {
        return (
            <div className="container-rurapp py-20 max-w-md text-center" data-testid="ai-login-required">
                <Bot className="h-12 w-12 mx-auto text-rurapp-forest" />
                <h1 className="font-heading text-2xl font-bold mt-4">Conoce a Rura</h1>
                <p className="text-rurapp-inkSoft mt-2">Tu asistente experto en agro. Inicia sesión para conversar.</p>
                <a href="/login" className="btn-primary inline-block mt-6">Entrar</a>
            </div>
        );
    }

    const send = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        const text = input.trim();
        setMessages((p) => [...p, { role: "user", content: text }]);
        setInput("");
        setLoading(true);
        try {
            const { data } = await api.post("/ai/chat", { message: text, session_id: sessionId });
            setSessionId(data.session_id);
            setMessages((p) => [...p, { role: "assistant", content: data.reply }]);
        } catch (e) {
            setMessages((p) => [...p, { role: "assistant", content: "Tuve un problema para responder. Intenta de nuevo." }]);
        } finally { setLoading(false); }
    };

    const quick = [
        "¿Cómo cuido un ternero recién nacido?",
        "¿Qué cultivo es bueno para tierras frías en Boyacá?",
        "Tips para vender mejor mi producto en la ciudad",
    ];

    return (
        <div className="container-rurapp py-6 max-w-3xl flex flex-col h-[calc(100vh-180px)]" data-testid="ai-page">
            <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-rurapp-forest text-white flex items-center justify-center">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="font-heading text-2xl font-bold">Rura · Asistente del campo</h1>
                    <p className="text-sm text-rurapp-inkSoft">Hecho con Claude Sonnet 4.5 · Respuestas en español</p>
                </div>
            </div>

            <div ref={scroller} className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`} data-testid={`msg-${i}`}>
                        {m.role === "assistant" && (
                            <div className="h-9 w-9 rounded-xl bg-rurapp-leaf flex items-center justify-center flex-shrink-0">
                                <Bot className="h-5 w-5 text-rurapp-forest" />
                            </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl p-4 ${m.role === "user" ? "bg-rurapp-forest text-white" : "bg-white border border-rurapp-edge"}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                        {m.role === "user" && (
                            <div className="h-9 w-9 rounded-xl bg-rurapp-earth flex items-center justify-center flex-shrink-0">
                                <User className="h-5 w-5 text-white" />
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-2"><div className="h-9 w-9 rounded-xl bg-rurapp-leaf flex items-center justify-center"><Bot className="h-5 w-5 text-rurapp-forest" /></div>
                        <div className="bg-white border border-rurapp-edge rounded-2xl p-4 text-rurapp-inkMuted" data-testid="ai-typing">Pensando…</div>
                    </div>
                )}
            </div>

            {messages.length <= 1 && (
                <div className="flex flex-wrap gap-2 my-3">
                    {quick.map((q, i) => (
                        <button key={i} onClick={() => setInput(q)} className="chip-earth hover:bg-rurapp-earth hover:text-white" data-testid={`quick-${i}`}>{q}</button>
                    ))}
                </div>
            )}

            <form onSubmit={send} className="mt-3 flex gap-2 sticky bottom-0 bg-rurapp-bone pt-2">
                <input className="input-rurapp" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe tu pregunta…" data-testid="ai-input" />
                <button className="btn-primary inline-flex items-center gap-2" disabled={loading} data-testid="ai-send"><Send className="h-5 w-5" /></button>
            </form>
        </div>
    );
}
