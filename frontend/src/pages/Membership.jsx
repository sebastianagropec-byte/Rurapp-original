import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Check, Sparkles, Crown } from "lucide-react";
import PaymentProviderSelector from "../components/PaymentProviderSelector";

export default function Membership() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState("");
    const [provider, setProvider] = useState("stripe");

    useEffect(() => { api.get("/memberships/plans").then((r) => setPlans(r.data)); }, []);

    const onChoose = async (id) => {
        if (!user) return navigate("/login");
        if (user.role === "cliente") {
            alert("Las membresías son para productores y expertos");
            return;
        }
        setLoading(id);
        try {
            const { data } = await api.post("/memberships/checkout", {
                plan_id: id, origin_url: window.location.origin, payment_provider: provider,
            });
            window.location.href = data.checkout_url;
        } catch (e) {
            alert(e.response?.data?.detail || "Error al iniciar pago");
            setLoading("");
        }
    };

    return (
        <div className="container-rurapp py-12 max-w-5xl" data-testid="membership-page">
            <div className="text-center mb-10">
                <span className="chip-earth mb-3">Para campesinos y expertos</span>
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-rurapp-ink">Planes de membresía Rurapp</h1>
                <p className="text-rurapp-inkSoft mt-3 text-lg max-w-2xl mx-auto">
                    Activa tu cuenta y empieza a vender productos del campo o servicios profesionales.
                    Tu membresía sostiene la plataforma y la comunidad.
                </p>
                {user?.membership_active && (
                    <div className="mt-4 inline-flex items-center gap-2 chip text-base">
                        <Check className="h-4 w-4" /> Tu membresía está activa
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {plans.map((p) => (
                    <div key={p.id} className={`card-rurapp ${p.id === "pro" ? "ring-2 ring-rurapp-forest" : ""}`} data-testid={`plan-${p.id}`}>                        <div className="flex items-center gap-2 mb-2">
                            {p.id === "pro" ? <Crown className="h-5 w-5 text-rurapp-earth" /> : <Sparkles className="h-5 w-5 text-rurapp-forest" />}
                            <h3 className="font-heading text-2xl font-bold">{p.name}</h3>
                            {p.id === "pro" && <span className="ml-auto chip-earth">Recomendado</span>}
                        </div>
                        <p className="text-rurapp-inkSoft">{p.description}</p>
                        <div className="mt-4">
                            <span className="font-heading text-5xl font-bold text-rurapp-forest">${p.price}</span>
                            <span className="text-rurapp-inkMuted"> / mes</span>
                        </div>
                        <ul className="mt-5 space-y-2">
                            {(p.id === "basico" ? [
                                "Hasta 10 publicaciones activas",
                                "Pedidos directos de clientes",
                                "Sistema de reputación",
                                "Soporte por correo",
                            ] : [
                                "Publicaciones ilimitadas",
                                "Aparición destacada en búsquedas",
                                "Insignia 'Pro'",
                                "Acceso anticipado a nuevas funciones",
                                "Soporte prioritario",
                            ]).map((f, i) => (
                                <li key={i} className="flex items-start gap-2"><Check className="h-4 w-4 text-rurapp-forest mt-1 flex-shrink-0" /><span>{f}</span></li>
                            ))}
                        </ul>
                        <button onClick={() => onChoose(p.id)} disabled={loading === p.id}
                            className={`mt-6 w-full ${p.id === "pro" ? "btn-primary" : "btn-outline"}`}
                            data-testid={`choose-${p.id}`}>
                            {loading === p.id ? "Procesando…" : "Elegir plan"}
                        </button>
                    </div>
                ))}
            </div>
            {(user?.role === "productor" || user?.role === "veterinario") && (
                <div className="card-rurapp mt-6 max-w-md mx-auto">
                    <PaymentProviderSelector value={provider} onChange={setProvider} dataTestPrefix="mem-pp" />
                </div>
            )}
        </div>
    );
}
