import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ShieldCheck, CheckCircle2, XCircle, Sparkles, ExternalLink } from "lucide-react";

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
        </div>
    );
}
