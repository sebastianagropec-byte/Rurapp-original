import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plus, Edit3, Trash2 } from "lucide-react";

export function MyServices() {
    const { user } = useAuth();
    const [services, setServices] = useState([]);

    const load = () => api.get("/services/mine").then((r) => setServices(r.data));
    useEffect(() => { load(); }, []);

    const onDelete = async (id) => {
        if (!window.confirm("¿Eliminar este servicio?")) return;
        await api.delete(`/services/${id}`);
        load();
    };

    if (user?.role !== "veterinario") return <div className="container-rurapp py-20">Solo para expertos</div>;

    return (
        <div className="container-rurapp py-8" data-testid="my-services-page">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-heading text-3xl font-bold">Mis servicios</h1>
                <Link to="/mis-servicios/nuevo" className="btn-primary inline-flex items-center gap-2" data-testid="new-service-btn"><Plus className="h-4 w-4" /> Nuevo servicio</Link>
            </div>
            {services.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes servicios</div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map((s) => (
                        <div key={s.id} className="card-rurapp" data-testid={`ms-${s.id}`}>
                            <h3 className="font-heading font-semibold">{s.title}</h3>
                            <p className="text-sm text-rurapp-inkSoft line-clamp-2">{s.description}</p>
                            <div className="mt-3 flex items-center justify-between">
                                <div className="font-bold text-rurapp-forest">${s.price}</div>
                                <span className="text-xs text-rurapp-inkMuted">{s.duration_minutes} min</span>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <Link to={`/mis-servicios/editar/${s.id}`} className="btn-outline flex-1 inline-flex items-center justify-center gap-1 text-sm" data-testid={`s-edit-${s.id}`}><Edit3 className="h-4 w-4" /> Editar</Link>
                                <button onClick={() => onDelete(s.id)} className="px-4 rounded-xl border border-rurapp-edge text-red-600 hover:bg-red-50" data-testid={`s-del-${s.id}`}><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ServiceForm({ editing }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: "", description: "", category: "consulta_virtual", price: 0,
        duration_minutes: 30, image_url: "",
    });
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editing) {
            const id = window.location.pathname.split("/").pop();
            api.get(`/services/${id}`).then((r) => setForm(r.data));
        }
    }, [editing]);

    const onSubmit = async (e) => {
        e.preventDefault(); setErr(""); setLoading(true);
        try {
            if (editing) {
                const id = window.location.pathname.split("/").pop();
                await api.put(`/services/${id}`, form);
            } else {
                await api.post("/services", form);
            }
            navigate("/mis-servicios");
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos guardar el servicio");
        } finally { setLoading(false); }
    };

    if (user?.role !== "veterinario") return <div className="container-rurapp py-20">Solo para expertos</div>;

    return (
        <div className="container-rurapp py-8 max-w-3xl" data-testid="service-form">
            <h1 className="font-heading text-3xl font-bold mb-6">{editing ? "Editar servicio" : "Nuevo servicio"}</h1>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="sf-err">{err}</div>}
                <Field label="Título" testId="sf-title"><input required className="input-rurapp" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Categoría" testId="sf-cat"><select className="input-rurapp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {["consulta_virtual", "asesoria_tecnica", "visita_finca", "capacitacion"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                    </select></Field>
                    <Field label="Precio" testId="sf-price"><input type="number" required min={0} step="0.01" className="input-rurapp" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></Field>
                    <Field label="Duración (min)" testId="sf-dur"><input type="number" required min={5} className="input-rurapp" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })} /></Field>
                </div>
                <Field label="Descripción" testId="sf-desc"><textarea required rows={4} className="input-rurapp" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <Field label="URL de imagen" testId="sf-img"><input className="input-rurapp" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></Field>
                <button disabled={loading} className="btn-primary w-full" data-testid="sf-submit">{loading ? "Guardando…" : "Guardar"}</button>
            </form>
        </div>
    );
}

function Field({ label, children, testId }) {
    return <label className="block" data-testid={testId}><span className="text-sm font-medium">{label}</span><div className="mt-1">{children}</div></label>;
}
