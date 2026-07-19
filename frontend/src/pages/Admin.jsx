import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ShieldCheck, CheckCircle2, XCircle, Sparkles, ExternalLink, Ticket, Trash2, Copy, Plus } from "lucide-react";

export default function AdminPanel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [verifications, setVerifications] = useState([]);
    const [filter, setFilter] = useState("pending");

    useEffect(() => {
        if (!user) { navigate("/login"); return; }
        api.get("/admin/me")
            .then((r) => { setIsAdmin(r.data.is_admin); setLoading(false); })
            .catch(() => { setIsAdmin(false); setLoading(false); });
    }, [user, navigate]);

    useEffect(() => {
        if (!isAdmin) return;
        const params = filter === "all" ? {} : { status: filter };
        api.get("/admin/verifications", { params }).then((r) => setVerifications(r.data));
    }, [isAdmin, filter]);

    if (loading) return <div className="container-rurapp py-20 text-center text-rurapp-inkMuted">Cargando…</div>;
    if (!isAdmin) return (
        <div className="container-rurapp py-20 text-center" data-testid="not-admin">
            <ShieldCheck className="h-12 w-12 mx-auto text-rurapp-inkMuted" />
            <h1 className="font-heading text-2xl font-bold mt-4">Acceso restringido</h1>
            <p className="text-rurapp-inkSoft">Esta sección es solo para administradores.</p>
        </div>
    );

    const review = async (id, decision, notes = "") => {
        await api.post(`/admin/verifications/${id}/review`, { decision, admin_notes: notes });
        const params = filter === "all" ? {} : { status: filter };
        const { data } = await api.get("/admin/verifications", { params });
        setVerifications(data);
    };

    return (
        <div className="container-rurapp py-8 max-w-5xl" data-testid="admin-page">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-rurapp-forest text-white flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="font-heading text-3xl font-bold">Panel de administración</h1>
                    <p className="text-rurapp-inkSoft">Revisión de solicitudes de verificación</p>
                </div>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {[
                    { v: "pending", l: "Pendientes" },
                    { v: "ai_approved", l: "Pre-aprobados IA" },
                    { v: "approved", l: "Aprobados" },
                    { v: "rejected", l: "Rechazados" },
                    { v: "all", l: "Todos" },
                ].map(({ v, l }) => (
                    <button key={v} onClick={() => setFilter(v)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap ${filter === v ? "bg-rurapp-forest text-white border-rurapp-forest" : "bg-white text-rurapp-ink border-rurapp-edge hover:bg-rurapp-leaf"}`}
                        data-testid={`adm-filter-${v}`}>{l}</button>
                ))}
            </div>

            {verifications.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">No hay solicitudes en esta categoría</div>
            ) : (
                <div className="space-y-4">
                    {verifications.map((v) => (
                        <div key={v.id} className="card-rurapp" data-testid={`adm-ver-${v.id}`}>
                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-heading font-semibold">{v.user_name}</h3>
                                        <span className="chip">{v.user_email}</span>
                                    </div>
                                    <div className="text-sm text-rurapp-inkSoft space-y-1">
                                        <div><strong>Profesional:</strong> {v.professional_name}</div>
                                        <div><strong>Documento:</strong> {v.document_type.replace("_", " ")} #{v.professional_id}</div>
                                        {v.institution && <div><strong>Institución:</strong> {v.institution}</div>}
                                        {v.notes && <div><strong>Notas:</strong> {v.notes}</div>}
                                        {v.document_url && (
                                            <a href={v.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-rurapp-forest hover:underline">
                                                <ExternalLink className="h-3 w-3" /> Ver documento
                                            </a>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 rounded-xl bg-rurapp-leaf/40 border border-rurapp-edge">
                                        <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-rurapp-forest font-semibold mb-1">
                                            <Sparkles className="h-3 w-3" /> Análisis IA
                                        </div>
                                        <div className="text-sm">
                                            <strong>Recomendación:</strong> <span className="capitalize">{v.ai_recommendation || "—"}</span>
                                        </div>
                                        {v.ai_analysis && <p className="text-xs text-rurapp-inkSoft mt-1 whitespace-pre-wrap">{v.ai_analysis}</p>}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 md:w-48">
                                    <span className={`text-center text-xs px-3 py-1 rounded-full font-medium ${v.status === "approved" ? "bg-rurapp-leaf text-rurapp-forest" : v.status === "rejected" ? "bg-red-100 text-red-700" : "bg-rurapp-sand text-rurapp-earth2"}`}>
                                        {v.status}
                                    </span>
                                    {(v.status === "pending" || v.status === "ai_approved") && (
                                        <>
                                            <button onClick={() => review(v.id, "approve")} className="btn-primary text-sm inline-flex items-center justify-center gap-1" data-testid={`approve-${v.id}`}>
                                                <CheckCircle2 className="h-4 w-4" /> Aprobar
                                            </button>
                                            <button onClick={() => {
                                                const notes = window.prompt("Razón del rechazo (opcional)");
                                                review(v.id, "reject", notes || "");
                                            }} className="btn-outline text-sm inline-flex items-center justify-center gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" data-testid={`reject-${v.id}`}>
                                                <XCircle className="h-4 w-4" /> Rechazar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <DiscountCodesAdmin />
        </div>
    );
}


function DiscountCodesAdmin() {
    const [codes, setCodes] = useState([]);
    const [form, setForm] = useState({ code: "", months: 12, max_uses: 1, plan_id: "", notes: "", expires_at: "" });
    const [creating, setCreating] = useState(false);
    const [err, setErr] = useState("");

    const load = () => api.get("/admin/discount-codes").then((r) => setCodes(r.data));
    useEffect(() => { load(); }, []);

    const onCreate = async (e) => {
        e.preventDefault();
        setErr(""); setCreating(true);
        try {
            const payload = {
                months: parseInt(form.months) || 1,
                max_uses: parseInt(form.max_uses) || 1,
            };
            if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
            if (form.plan_id) payload.plan_id = form.plan_id;
            if (form.notes.trim()) payload.notes = form.notes.trim();
            if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
            await api.post("/admin/discount-codes", payload);
            setForm({ code: "", months: 12, max_uses: 1, plan_id: "", notes: "", expires_at: "" });
            await load();
        } catch (e2) {
            setErr(e2.response?.data?.detail || "No pudimos crear el código");
        } finally {
            setCreating(false);
        }
    };

    const onDelete = async (id) => {
        if (!window.confirm("¿Desactivar este código?")) return;
        await api.delete(`/admin/discount-codes/${id}`);
        load();
    };

    const copyCode = (code) => {
        navigator.clipboard?.writeText(code);
    };

    return (
        <section className="mt-12" data-testid="admin-discount-codes">
            <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-rurapp-earth text-white flex items-center justify-center">
                    <Ticket className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="font-heading text-2xl font-bold">Códigos de descuento</h2>
                    <p className="text-sm text-rurapp-inkSoft">Regala meses de membresía a productores y veterinarios</p>
                </div>
            </div>

            <form onSubmit={onCreate} className="card-rurapp mb-6 grid gap-3 sm:grid-cols-6" data-testid="dc-form">
                {err && <div className="sm:col-span-6 p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="dc-err">{err}</div>}
                <label className="sm:col-span-2 text-sm">
                    <span className="font-medium">Código (opcional)</span>
                    <input className="input-rurapp mt-1" value={form.code} placeholder="Se genera automático si lo dejas vacío"
                        onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="dc-code" />
                </label>
                <label className="text-sm">
                    <span className="font-medium">Meses gratis</span>
                    <select className="input-rurapp mt-1" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} data-testid="dc-months">
                        <option value={1}>1 mes</option>
                        <option value={3}>3 meses</option>
                        <option value={6}>6 meses</option>
                        <option value={12}>12 meses (1 año)</option>
                        <option value={24}>24 meses (2 años)</option>
                    </select>
                </label>
                <label className="text-sm">
                    <span className="font-medium">Máx. usos</span>
                    <input type="number" min={1} className="input-rurapp mt-1" value={form.max_uses}
                        onChange={(e) => setForm({ ...form, max_uses: e.target.value })} data-testid="dc-uses" />
                </label>
                <label className="text-sm">
                    <span className="font-medium">Plan</span>
                    <select className="input-rurapp mt-1" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} data-testid="dc-plan">
                        <option value="">Cualquiera</option>
                        <option value="basico">Sólo Básico</option>
                        <option value="pro">Sólo Pro</option>
                    </select>
                </label>
                <label className="text-sm">
                    <span className="font-medium">Expira (opcional)</span>
                    <input type="date" className="input-rurapp mt-1" value={form.expires_at}
                        onChange={(e) => setForm({ ...form, expires_at: e.target.value })} data-testid="dc-expires" />
                </label>
                <label className="sm:col-span-5 text-sm">
                    <span className="font-medium">Notas internas</span>
                    <input className="input-rurapp mt-1" value={form.notes} placeholder="Ej: Campaña embajadores Boyacá"
                        onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="dc-notes" />
                </label>
                <button disabled={creating} type="submit" className="btn-primary sm:col-span-1 inline-flex items-center justify-center gap-2" data-testid="dc-submit">
                    <Plus className="h-4 w-4" /> {creating ? "Creando…" : "Crear"}
                </button>
            </form>

            {codes.length === 0 ? (
                <div className="card-rurapp text-center py-8 text-rurapp-inkMuted" data-testid="dc-empty">Aún no has creado códigos</div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-rurapp-edge bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-rurapp-leaf/40 text-rurapp-forest">
                            <tr>
                                <th className="text-left px-4 py-2">Código</th>
                                <th className="text-left px-4 py-2">Meses</th>
                                <th className="text-left px-4 py-2">Usos</th>
                                <th className="text-left px-4 py-2">Plan</th>
                                <th className="text-left px-4 py-2">Expira</th>
                                <th className="text-left px-4 py-2">Estado</th>
                                <th className="px-2 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.map((c) => (
                                <tr key={c.id} className="border-t border-rurapp-edge" data-testid={`dc-row-${c.id}`}>
                                    <td className="px-4 py-2 font-mono font-semibold flex items-center gap-2">
                                        {c.code}
                                        <button onClick={() => copyCode(c.code)} className="text-rurapp-inkMuted hover:text-rurapp-forest" title="Copiar" data-testid={`dc-copy-${c.id}`}>
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                    <td className="px-4 py-2">{c.months}</td>
                                    <td className="px-4 py-2">{c.uses}/{c.max_uses}</td>
                                    <td className="px-4 py-2">{c.plan_id || "cualquiera"}</td>
                                    <td className="px-4 py-2">{c.expires_at ? c.expires_at.slice(0, 10) : "—"}</td>
                                    <td className="px-4 py-2">
                                        {c.active ? <span className="chip">Activo</span> : <span className="text-xs text-rurapp-inkMuted">Inactivo</span>}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        {c.active && (
                                            <button onClick={() => onDelete(c.id)} className="text-red-600 hover:bg-red-50 rounded-lg p-1.5" title="Desactivar" data-testid={`dc-del-${c.id}`}>
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

