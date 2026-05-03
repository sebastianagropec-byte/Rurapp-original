import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Save, User } from "lucide-react";

export default function Profile() {
    const { user, refresh } = useAuth();
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (user) setForm({
            full_name: user.full_name || "",
            phone: user.phone || "",
            location: user.location || "",
            bio: user.bio || "",
            avatar_url: user.avatar_url || "",
            specialty: user.specialty || "",
        });
    }, [user]);

    const onSubmit = async (e) => {
        e.preventDefault(); setSaving(true); setMsg("");
        try {
            await api.put("/auth/me", form);
            await refresh();
            setMsg("Perfil actualizado");
        } finally { setSaving(false); }
    };

    if (!user) return <div className="container-rurapp py-20">Inicia sesión</div>;

    return (
        <div className="container-rurapp py-8 max-w-2xl" data-testid="profile-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Mi perfil</h1>
            <div className="card-rurapp flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-rurapp-forest flex items-center justify-center text-white">
                    {form.avatar_url ? <img src={form.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-8 w-8" />}
                </div>
                <div>
                    <div className="font-heading text-xl font-semibold">{user.full_name}</div>
                    <div className="text-rurapp-inkSoft">{user.email} · <span className="capitalize">{user.role}</span></div>
                    {user.role !== "cliente" && (
                        <div className="text-xs mt-1">
                            {user.membership_active ? <span className="chip">Membresía activa</span> : <span className="chip-earth">Sin membresía</span>}
                        </div>
                    )}
                </div>
            </div>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                {msg && <div className="p-3 rounded-xl bg-rurapp-leaf text-rurapp-forest text-sm" data-testid="profile-msg">{msg}</div>}
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Nombre completo" testId="prf-name"><input className="input-rurapp" value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
                    <Field label="Teléfono" testId="prf-phone"><input className="input-rurapp" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                    <Field label="Ubicación" testId="prf-loc"><input className="input-rurapp" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                    <Field label="URL de avatar" testId="prf-avatar"><input className="input-rurapp" value={form.avatar_url || ""} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://..." /></Field>
                    {user.role === "veterinario" && (
                        <Field label="Especialidad" testId="prf-spec"><input className="input-rurapp" value={form.specialty || ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Ej: Bovinos, Avicultura" /></Field>
                    )}
                </div>
                <Field label="Sobre mí" testId="prf-bio"><textarea rows={4} className="input-rurapp" value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
                <button disabled={saving} className="btn-primary inline-flex items-center gap-2" data-testid="prf-save"><Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar cambios"}</button>
            </form>
        </div>
    );
}

function Field({ label, children, testId }) {
    return <label className="block" data-testid={testId}><span className="text-sm font-medium">{label}</span><div className="mt-1">{children}</div></label>;
}
