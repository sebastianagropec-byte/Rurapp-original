import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Check, Sparkles, Crown, Gift, Clock, AlertTriangle, Ticket } from "lucide-react";
import PaymentProviderSelector from "../components/PaymentProviderSelector";

export default function Membership() {
    const { user, refresh } = useAuth();
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState("");
    const [trialLoading, setTrialLoading] = useState("");
    const [provider, setProvider] = useState("stripe");
    const [redeemCode, setRedeemCode] = useState("");
    const [redeemPlan, setRedeemPlan] = useState("basico");
    const [redeemLoading, setRedeemLoading] = useState(false);
    const [redeemMsg, setRedeemMsg] = useState(null);

    const loadStatus = async () => {
        if (!user || user.role === "cliente") return;
        try {
            const { data } = await api.get("/memberships/status");
            setStatus(data);
        } catch { /* ignore */ }
    };

    useEffect(() => { api.get("/memberships/plans").then((r) => setPlans(r.data)); }, []);
    useEffect(() => { loadStatus(); }, [user]);

    const canTrial = user && (user.role === "productor" || user.role === "veterinario")
        && status && !status.trial_used && !status.membership_active;

    const onStartTrial = async (id) => {
        if (!user) return navigate("/login");
        setTrialLoading(id);
        try {
            await api.post("/memberships/start-trial", {
                plan_id: id, origin_url: window.location.origin,
            });
            await refresh?.();
            await loadStatus();
            navigate("/dashboard");
        } catch (e) {
            alert(e.response?.data?.detail || "No se pudo iniciar la prueba gratis");
        } finally {
            setTrialLoading("");
        }
    };

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

    const onRedeem = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/login");
        setRedeemMsg(null); setRedeemLoading(true);
        try {
            const { data } = await api.post("/memberships/redeem-code", {
                code: redeemCode.trim(),
                plan_id: redeemPlan,
            });
            setRedeemMsg({
                type: "ok",
                text: `¡Listo! Activamos ${data.months} mes(es) del plan ${data.plan_id} sin pago. Válido hasta ${data.membership_expires_at.slice(0, 10)}.`,
            });
            setRedeemCode("");
            await refresh?.();
            await loadStatus();
        } catch (e2) {
            setRedeemMsg({
                type: "err",
                text: e2.response?.data?.detail || "No pudimos canjear ese código",
            });
        } finally {
            setRedeemLoading(false);
        }
    };

    return (
        <div className="container-rurapp py-12 max-w-5xl" data-testid="membership-page">
            <div className="text-center mb-10">
                <span className="chip-earth mb-3 inline-flex items-center gap-1">
                    <Gift className="h-3 w-3" /> 7 días gratis · sin tarjeta
                </span>
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-rurapp-ink">Planes de membresía Rurapp</h1>
                <p className="text-rurapp-inkSoft mt-3 text-lg max-w-2xl mx-auto">
                    Activa tu cuenta y empieza a vender productos del campo o servicios profesionales.
                    Prueba 7 días gratis cualquier plan antes de pagar.
                </p>
                {status?.membership_active && (
                    <div className="mt-4 inline-flex items-center gap-2 chip text-base" data-testid="membership-active-chip">
                        {status.on_trial ? (
                            <>
                                <Clock className="h-4 w-4" />
                                Prueba gratis activa · {status.days_left ?? 7} día(s) restantes
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> Tu membresía está activa
                            </>
                        )}
                    </div>
                )}
                {status?.reminder && (
                    <div className="mt-3 max-w-xl mx-auto rounded-2xl border border-rurapp-earth/40 bg-rurapp-earth/10 text-rurapp-ink px-4 py-3 flex items-start gap-2" data-testid="trial-reminder">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-rurapp-earth flex-shrink-0" />
                        <span className="text-sm">
                            Tu prueba gratis termina en <strong>{status.days_left} día(s)</strong>. Elige un plan ahora para no perder tus publicaciones.
                        </span>
                    </div>
                )}
                {status && status.trial_used && !status.on_trial && (
                    <p className="text-xs text-rurapp-inkMuted mt-3" data-testid="trial-used-note">
                        Ya usaste tu prueba gratis. Elige un plan pagado para continuar.
                    </p>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {plans.map((p) => (
                    <div key={p.id} className={`card-rurapp ${p.id === "pro" ? "ring-2 ring-rurapp-forest" : ""}`} data-testid={`plan-${p.id}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {p.id === "pro" ? <Crown className="h-5 w-5 text-rurapp-earth" /> : <Sparkles className="h-5 w-5 text-rurapp-forest" />}
                            <h3 className="font-heading text-2xl font-bold">{p.name}</h3>
                            {p.id === "pro" && <span className="ml-auto chip-earth">Recomendado</span>}
                        </div>
                        <p className="text-rurapp-inkSoft">{p.description}</p>
                        <div className="mt-4">
                            <span className="font-heading text-5xl font-bold text-rurapp-forest">${p.price}</span>
                            <span className="text-rurapp-inkMuted"> / mes</span>
                            <div className="mt-1 inline-flex items-center gap-1 text-xs text-rurapp-forest font-semibold">
                                <Gift className="h-3 w-3" /> 7 días gratis · sin cobro inicial
                            </div>
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
                                <li key={`${p.id}-feat-${i}`} className="flex items-start gap-2"><Check className="h-4 w-4 text-rurapp-forest mt-1 flex-shrink-0" /><span>{f}</span></li>
                            ))}
                        </ul>

                        {canTrial && (
                            <button onClick={() => onStartTrial(p.id)} disabled={trialLoading === p.id}
                                className="mt-6 w-full btn-primary inline-flex items-center justify-center gap-2"
                                data-testid={`trial-${p.id}`}>
                                <Gift className="h-4 w-4" />
                                {trialLoading === p.id ? "Activando…" : "Empezar 7 días gratis"}
                            </button>
                        )}

                        <button onClick={() => onChoose(p.id)} disabled={loading === p.id}
                            className={`${canTrial ? "mt-3" : "mt-6"} w-full ${p.id === "pro" && !canTrial ? "btn-primary" : "btn-outline"}`}
                            data-testid={`choose-${p.id}`}>
                            {loading === p.id ? "Procesando…" : (canTrial ? "Pagar directo (omitir prueba)" : "Elegir plan")}
                        </button>
                    </div>
                ))}
            </div>
            {(user?.role === "productor" || user?.role === "veterinario") && (
                <>
                    <div className="card-rurapp mt-6 max-w-md mx-auto" data-testid="redeem-code-card">
                        <div className="flex items-center gap-2 mb-2">
                            <Ticket className="h-5 w-5 text-rurapp-earth" />
                            <h3 className="font-heading text-lg font-semibold">¿Tienes un código de descuento?</h3>
                        </div>
                        <p className="text-sm text-rurapp-inkSoft mb-3">Canjea meses gratis de membresía sin necesidad de pagar.</p>
                        <form onSubmit={onRedeem} className="space-y-3">
                            <input
                                required
                                className="input-rurapp font-mono uppercase tracking-widest"
                                placeholder="RURA-XXXXXXXX"
                                value={redeemCode}
                                onChange={(ev) => setRedeemCode(ev.target.value.toUpperCase())}
                                data-testid="redeem-code-input"
                            />
                            <select className="input-rurapp" value={redeemPlan} onChange={(ev) => setRedeemPlan(ev.target.value)} data-testid="redeem-plan-select">
                                <option value="basico">Plan Básico</option>
                                <option value="pro">Plan Pro</option>
                            </select>
                            <button disabled={redeemLoading || !redeemCode.trim()} className="btn-outline w-full inline-flex items-center justify-center gap-2" data-testid="redeem-submit">
                                <Ticket className="h-4 w-4" />
                                {redeemLoading ? "Canjeando…" : "Canjear código"}
                            </button>
                            {redeemMsg && (
                                <div
                                    className={`text-sm p-2 rounded-lg border ${redeemMsg.type === "ok" ? "bg-rurapp-leaf/60 border-rurapp-forest/30 text-rurapp-forest" : "bg-red-50 border-red-200 text-red-700"}`}
                                    data-testid="redeem-msg"
                                >
                                    {redeemMsg.text}
                                </div>
                            )}
                        </form>
                    </div>
                    <div className="card-rurapp mt-6 max-w-md mx-auto">
                        <PaymentProviderSelector value={provider} onChange={setProvider} dataTestPrefix="mem-pp" allowCod={false} />
                    </div>
                </>
            )}
        </div>
    );
}
