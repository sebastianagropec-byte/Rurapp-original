import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ShieldCheck, FileText, Sparkles, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS = {
    none: { label: "No verificado", color: "bg-rurapp-sand text-rurapp-inkSoft", icon: FileText },
    pending: { label: "En revisión", color: "bg-rurapp-sand text-rurapp-earth2", icon: Clock },
    ai_approved: { label: "Pre-aprobado por IA · pendiente de admin", color: "bg-blue-50 text-blue-700", icon: Sparkles },
    approved: { label: "Verificado ✓", color: "bg-rurapp-leaf text-rurapp-forest", icon: CheckCircle2 },
    rejected: { label: "Rechazado", color: "bg-red-50 text-red-700", icon: XCircle },
};

export default function Verification() {
    const { user, refresh } = useAuth();
    const navigate = useNavigate();
    const [existing, setExisting] = useState(null);
    const [form, setForm] = useState({
        document_type: "tarjeta_profesional",
        document_url: "",
        professional_name: "",
        professional_id: "",
        institution: "",
        notes: "",
    });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!user) return;
        if (user.role !== "veterinario") return;
        api.get("/verifications/mine").then((r) => {
            if (r.data) setExisting(r.data);
            if (!r.data && user.full_name) setForm((f) => ({ ...f, professional_name: user.full_name }));
        }).catch(() => {});
    }, [user]);

    if (!user) return <div className="container-rurapp py-20 text-center">Inicia sesión</div>;
    if (user.role !== "veterinario") return <div className="container-rurapp py-20 text-center">Solo expertos del campo pueden solicitar verificación</div>;

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            const { data } = await api.post("/verifications", form);
            setExisting(data);
            await refresh();
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos enviar la solicitud");
        } finally { setLoading(false); }
    };

    const status = existing?.status || user.verification_status || "none";
    const meta = STATUS[status] || STATUS.none;
    const Icon = meta.icon;

    return (
        <div className="container-rurapp py-8 max-w-3xl" data-testid="verification-page">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-rurapp-forest text-white flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="font-heading text-3xl font-bold">Verificación profesional</h1>
                    <p className="text-rurapp-inkSoft">Genera confianza con un sello &ldquo;Verificado&rdquo;</p>
                </div>
            </div>

            <div className={`card-rurapp mb-6 flex items-start gap-3 ${meta.color}`} data-testid="verification-status">
                <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="font-heading font-semibold">{meta.label}</div>
                    {existing?.ai_recommendation && (
                        <p className="text-sm mt-2 opacity-80">
                            <strong>Pre-análisis IA:</strong> {existing.ai_recommendation === "approve" ? "Aprueba" : existing.ai_recommendation === "reject" ? "Rechaza" : "Requiere revisión humana"}
                        </p>
                    )}
                    {existing?.ai_analysis && (
                        <p className="text-xs mt-1 opacity-70 whitespace-pre-wrap">{existing.ai_analysis}</p>
                    )}
                    {existing?.admin_notes && (
                        <p className="text-sm mt-2"><strong>Notas del admin:</strong> {existing.admin_notes}</p>
                    )}
                </div>
            </div>

            {(status === "none" || status === "rejected") && (
                <form onSubmit={onSubmit} className="card-rurapp space-y-4" data-testid="verification-form">
                    {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" />{err}</div>}
                    <p className="text-rurapp-inkSoft text-sm">
                        Tu solicitud pasa por dos pasos: 1) <strong>IA pre-aprueba</strong> con Claude Sonnet 4.5 analizando coherencia. 2) <strong>Admin confirma</strong> manualmente.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Tipo de documento">
                            <select className="input-rurapp" value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })} data-testid="ver-doctype">
                                <option value="tarjeta_profesional">Tarjeta profesional</option>
                                <option value="cedula_profesional">Cédula profesional</option>
                                <option value="diploma">Diploma</option>
                            </select>
                        </Field>
                        <Field label="Número / matrícula"><input required className="input-rurapp" value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })} data-testid="ver-id" /></Field>
                        <Field label="Nombre profesional"><input required className="input-rurapp" value={form.professional_name} onChange={(e) => setForm({ ...form, professional_name: e.target.value })} data-testid="ver-name" /></Field>
                        <Field label="Institución"><input className="input-rurapp" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Ej: Universidad Nacional" data-testid="ver-inst" /></Field>
                    </div>
                    <Field label="URL de la imagen del documento (opcional pero recomendado)">
                        <input className="input-rurapp" value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} placeholder="https://..." data-testid="ver-doc" />
                    </Field>
                    <Field label="Notas adicionales">
                        <textarea rows={3} className="input-rurapp" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="ver-notes" />
                    </Field>
                    <button disabled={loading} className="btn-primary w-full" data-testid="ver-submit">{loading ? "Enviando…" : "Enviar a verificación"}</button>
                </form>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-sm font-medium">{label}</span><div className="mt-1">{children}</div></label>;
}
