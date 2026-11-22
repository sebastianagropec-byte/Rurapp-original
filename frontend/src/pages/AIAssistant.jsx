import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Sparkles, Send, Bot, User, AlertTriangle, Stethoscope, Leaf, ShieldCheck } from "lucide-react";

const PRO_LABEL = {
    veterinario: { label: "veterinario verificado", icon: Stethoscope, href: "/servicios?category=salud_animal" },
    agronomo: { label: "agrónomo verificado", icon: Leaf, href: "/servicios?category=agronomia" },
};

export default function AIAssistant() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        {
            id: "init",
            role: "assistant",
            content: "Hola, soy Rura. Pregúntame lo que necesites sobre tus cultivos, tus animales, cómo cuidarlos mejor o cómo vender tu cosecha en la ciudad. Recuerda: cuando el caso lo amerite, te voy a sugerir consultar a un profesional del campo verificado en Rurapp.",
        },
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
                <Link to="/login" className="btn-primary inline-block mt-6">Entrar</Link>
            </div>
        );
    }

    const send = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        const text = input.trim();
        const userMsgId = `u_${Date.now()}`;
        setMessages((p) => [...p, { id: userMsgId, role: "user", content: text }]);
        setInput("");
        setLoading(true);
        try {
            const { data } = await api.post("/ai/chat", { message: text, session_id: sessionId });
            setSessionId(data.session_id);
            setMessages((p) => [...p, {
                id: `a_${Date.now()}`,
                role: "assistant",
                content: data.reply,
                suggested_professional: data.suggested_professional,
                urgent: data.urgent,
                topic: data.topic,
            }]);
        } catch (_e) {
            setMessages((p) => [...p, { id: `e_${Date.now()}`, role: "assistant", content: "Tuve un problema para responder. Intenta de nuevo." }]);
        } finally { setLoading(false); }
    };

    const quick = [
        "¿Cómo cuido un ternero recién nacido?",
        "¿Qué cultivo es bueno para tierras frías en Boyacá?",
        "Mi vaca está decaída y no come",
        "Tips para vender mejor mi producto en la ciudad",
    ];

    return (
        <div className="container-rurapp py-6 max-w-3xl flex flex-col h-[calc(100vh-180px)]" data-testid="ai-page">
            <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-2xl bg-rurapp-forest text-white flex items-center justify-center">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="font-heading text-2xl font-bold">Rura · Asistente del campo</h1>
                    <p className="text-sm text-rurapp-inkSoft">Claude Sonnet 4.5 · No reemplaza a un profesional</p>
                </div>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-rurapp-leaf/40 border border-rurapp-edge flex items-start gap-2 text-sm text-rurapp-forest" data-testid="ai-disclaimer">
                <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Rura orienta, pero no diagnostica ni receta. Para casos de salud animal o decisiones técnicas, consulta siempre a un profesional verificado.</span>
            </div>

            <div ref={scroller} className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.map((m) => {
                    const pro = m.suggested_professional && m.suggested_professional !== "ninguno" ? PRO_LABEL[m.suggested_professional] : null;
                    const Icon = pro?.icon;
                    return (
                        <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`} data-testid={`msg-${m.id}`}>
                            {m.role === "assistant" && (
                                <div className="h-9 w-9 rounded-xl bg-rurapp-leaf flex items-center justify-center flex-shrink-0">
                                    <Bot className="h-5 w-5 text-rurapp-forest" />
                                </div>
                            )}
                            <div className={`max-w-[85%] rounded-2xl p-4 ${m.role === "user" ? "bg-rurapp-forest text-white" : "bg-white border border-rurapp-edge"}`}>
                                {m.urgent && (
                                    <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2" data-testid={`msg-${m.id}-urgent`}>
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span><strong>Posible urgencia.</strong> Contacta cuanto antes a un veterinario. Esta app no es un servicio de emergencias.</span>
                                    </div>
                                )}
                                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                {pro && (
                                    <Link
                                        to={pro.href}
                                        className="mt-3 inline-flex items-center gap-2 chip-earth hover:bg-rurapp-earth hover:text-white transition-colors"
                                        data-testid={`msg-${m.id}-pro-cta`}
                                    >
                                        {Icon && <Icon className="h-4 w-4" />}
                                        Consulta un {pro.label}
                                    </Link>
                                )}
                            </div>
                            {m.role === "user" && (
                                <div className="h-9 w-9 rounded-xl bg-rurapp-earth flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5 text-white" />
                                </div>
                            )}
                        </div>
                    );
                })}
                {loading && (
                    <div className="flex gap-2"><div className="h-9 w-9 rounded-xl bg-rurapp-leaf flex items-center justify-center"><Bot className="h-5 w-5 text-rurapp-forest" /></div>
                        <div className="bg-white border border-rurapp-edge rounded-2xl p-4 text-rurapp-inkMuted" data-testid="ai-typing">Pensando…</div>
                    </div>
                )}
            </div>

            {messages.length <= 1 && (
                <div className="flex flex-wrap gap-2 my-3" data-testid="ai-quick-prompts">
                    {quick.map((q, i) => (
                        <button key={q} onClick={() => setInput(q)} className="chip-earth hover:bg-rurapp-earth hover:text-white" data-testid={`quick-${i}`}>{q}</button>
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
