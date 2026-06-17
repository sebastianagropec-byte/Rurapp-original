import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, getToken, BACKEND_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MessageCircle, Send, ArrowLeft, User, Circle } from "lucide-react";

export function ConversationsList() {
    const { user } = useAuth();
    const [convs, setConvs] = useState([]);

    useEffect(() => { if (user) api.get("/conversations").then((r) => setConvs(r.data)); }, [user]);

    if (!user) return <div className="container-rurapp py-20 text-center">Inicia sesión para chatear</div>;

    return (
        <div className="container-rurapp py-8 max-w-3xl" data-testid="conversations-page">
            <h1 className="font-heading text-3xl font-bold mb-6 flex items-center gap-2"><MessageCircle className="h-7 w-7 text-rurapp-forest" /> Mensajes</h1>
            {convs.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted" data-testid="conv-empty">
                    Aún no tienes conversaciones. Visita un productor o experto y abre un chat.
                </div>
            ) : (
                <div className="space-y-3">
                    {convs.map((c) => {
                        const otherId = c.participants.find((p) => p !== user.id);
                        const otherName = c.participant_names?.[otherId] || "Usuario";
                        const unread = c.unread_for?.[user.id] || 0;
                        return (
                            <Link key={c.id} to={`/chat/${c.id}`} className="card-rurapp flex items-center gap-3 hover:-translate-y-0.5 transition-transform" data-testid={`conv-${c.id}`}>
                                <div className="h-12 w-12 rounded-full bg-rurapp-forest flex items-center justify-center text-white"><User className="h-6 w-6" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-heading font-semibold">{otherName}</span>
                                        {unread > 0 && <span className="bg-rurapp-earth text-white text-xs rounded-full px-2 py-0.5 font-semibold">{unread}</span>}
                                    </div>
                                    <p className="text-sm text-rurapp-inkSoft truncate">{c.last_message || "Sin mensajes aún"}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function ChatRoom() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [other, setOther] = useState(null);
    const [otherOnline, setOtherOnline] = useState(false);
    const wsRef = useRef(null);
    const scroller = useRef(null);

    useEffect(() => {
        if (!user) return;
        api.get(`/conversations/${id}/messages`)
            .then((r) => setMessages(r.data))
            .catch((err) => {
                if (process.env.NODE_ENV !== "production") {
                    console.warn("No se pudieron cargar mensajes:", err?.message);
                }
            });
        api.get("/conversations").then((r) => {
            const c = r.data.find((x) => x.id === id);
            if (c) {
                const otherId = c.participants.find((p) => p !== user.id);
                setOther({ id: otherId, name: c.participant_names?.[otherId] });
            }
        }).catch(() => {});
    }, [id, user]);

    useEffect(() => {
        if (!user) return;
        const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws/chat?token=${encodeURIComponent(getToken())}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                if (data.type === "message" && data.conversation_id === id) {
                    setMessages((prev) => [...prev, data.message]);
                }
            } catch (_) {
                /* ignore malformed message */
            }
        };
        ws.onerror = () => {};
        return () => ws.close();
    }, [id, user]);

    useEffect(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const send = async (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        setText("");
        const { data } = await api.post("/messages", { conversation_id: id, content: t });
        setMessages((prev) => [...prev, data]);
    };

    if (!user) return <div className="container-rurapp py-20 text-center">Inicia sesión</div>;

    return (
        <div className="container-rurapp py-4 md:py-6 max-w-3xl flex flex-col h-[calc(100vh-160px)]" data-testid="chat-room">
            <div className="card-rurapp flex items-center gap-3 mb-3 p-4">
                <button onClick={() => navigate("/chat")} className="p-2 rounded-lg hover:bg-rurapp-leaf" data-testid="chat-back"><ArrowLeft className="h-5 w-5" /></button>
                <div className="h-10 w-10 rounded-full bg-rurapp-forest flex items-center justify-center text-white"><User className="h-5 w-5" /></div>
                <div className="flex-1">
                    <div className="font-heading font-semibold">{other?.name || "Conversación"}</div>
                    <div className="text-xs text-rurapp-inkMuted flex items-center gap-1">
                        <Circle className={`h-2 w-2 fill-current ${otherOnline ? "text-green-500" : "text-rurapp-inkMuted"}`} />
                        {otherOnline ? "En línea" : "Desconectado"}
                    </div>
                </div>
            </div>
            <div ref={scroller} className="flex-1 overflow-y-auto space-y-2 bg-white rounded-2xl border border-rurapp-edge p-4">
                {messages.length === 0 ? (
                    <p className="text-center text-rurapp-inkMuted py-8">Inicia la conversación 👋</p>
                ) : messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.id}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? "bg-rurapp-forest text-white" : "bg-rurapp-leaf text-rurapp-ink"}`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-rurapp-inkMuted"}`}>
                                    {new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={send} className="mt-3 flex gap-2">
                <input className="input-rurapp" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" data-testid="chat-input" />
                <button className="btn-primary inline-flex items-center gap-2" data-testid="chat-send"><Send className="h-5 w-5" /></button>
            </form>
        </div>
    );
}

export function StartChatButton({ otherUserId, label = "Enviar mensaje", className = "btn-outline" }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    if (!user || user.id === otherUserId) return null;
    const onClick = async () => {
        try {
            const { data } = await api.post("/conversations", { other_user_id: otherUserId });
            navigate(`/chat/${data.id}`);
        } catch (e) {
            if (e.response?.status === 401) navigate("/login");
        }
    };
    return (
        <button onClick={onClick} className={`${className} inline-flex items-center gap-2`} data-testid="start-chat-btn">
            <MessageCircle className="h-4 w-4" /> {label}
        </button>
    );
}
