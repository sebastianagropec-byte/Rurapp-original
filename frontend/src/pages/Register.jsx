import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Sprout, AlertCircle, ShoppingBasket, Stethoscope, Tractor } from "lucide-react";

const ROLES = [
    { value: "cliente", label: "Soy cliente", desc: "Comprar productos y agendar servicios", icon: ShoppingBasket },
    { value: "productor", label: "Soy productor", desc: "Vender productos del campo", icon: Tractor },
    { value: "veterinario", label: "Soy experto", desc: "Veterinario / asesor agropecuario", icon: Stethoscope },
];

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [role, setRole] = useState("cliente");
    const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", location: "", bio: "" });
    const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);

    const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const onSubmit = async (e) => {
        e.preventDefault(); setErr(""); setLoading(true);
        try {
            const u = await register({ ...form, role });
            if (u.role !== "cliente") navigate("/membresia");
            else navigate("/dashboard");
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos crear tu cuenta");
        } finally { setLoading(false); }
    };

    return (
        <div className="container-rurapp py-10 md:py-14 max-w-2xl" data-testid="register-page">
            <div className="text-center mb-8">
                <div className="inline-flex h-14 w-14 rounded-2xl bg-rurapp-forest items-center justify-center mb-3">
                    <Sprout className="h-7 w-7 text-white" />
                </div>
                <h1 className="font-heading text-3xl font-bold text-rurapp-ink">Únete a Rurapp</h1>
                <p className="text-rurapp-inkSoft mt-1">Cuéntanos quién eres para personalizar tu experiencia</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {ROLES.map(({ value, label, desc, icon: Icon }) => (
                    <button type="button" key={value} onClick={() => setRole(value)}
                        className={`card-rurapp text-left transition-all ${role === value ? "ring-2 ring-rurapp-forest border-rurapp-forest" : ""}`}
                        data-testid={`role-${value}`}>
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${role === value ? "bg-rurapp-forest text-white" : "bg-rurapp-leaf text-rurapp-forest"}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="font-heading font-semibold text-rurapp-ink">{label}</div>
                        <div className="text-xs text-rurapp-inkSoft mt-1">{desc}</div>
                    </button>
                ))}
            </div>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                {err && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200" data-testid="register-error"><AlertCircle className="h-4 w-4" /><span className="text-sm">{err}</span></div>}
                <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block"><span className="text-sm font-medium">Nombre completo</span>
                        <input required className="input-rurapp mt-1" value={form.full_name} onChange={(e) => onChange("full_name", e.target.value)} data-testid="reg-name" /></label>
                    <label className="block"><span className="text-sm font-medium">Teléfono</span>
                        <input className="input-rurapp mt-1" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="3001234567" data-testid="reg-phone" /></label>
                    <label className="block"><span className="text-sm font-medium">Correo</span>
                        <input type="email" required className="input-rurapp mt-1" value={form.email} onChange={(e) => onChange("email", e.target.value)} data-testid="reg-email" /></label>
                    <label className="block"><span className="text-sm font-medium">Contraseña</span>
                        <input type="password" required minLength={6} className="input-rurapp mt-1" value={form.password} onChange={(e) => onChange("password", e.target.value)} data-testid="reg-password" /></label>
                    <label className="block sm:col-span-2"><span className="text-sm font-medium">Ubicación (departamento o municipio)</span>
                        <input className="input-rurapp mt-1" value={form.location} onChange={(e) => onChange("location", e.target.value)} placeholder="Ej: Cundinamarca, Boyacá" data-testid="reg-location" /></label>
                    <label className="block sm:col-span-2"><span className="text-sm font-medium">Cuéntanos sobre ti</span>
                        <textarea rows={3} className="input-rurapp mt-1" value={form.bio} onChange={(e) => onChange("bio", e.target.value)} placeholder={role === "productor" ? "Tu finca, tu historia, tus prácticas…" : role === "veterinario" ? "Especialidad, experiencia…" : "Qué buscas en Rurapp"} data-testid="reg-bio" /></label>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="register-submit">{loading ? "Creando…" : "Crear mi cuenta"}</button>
                <p className="text-center text-sm text-rurapp-inkSoft">¿Ya tienes cuenta? <Link to="/login" className="text-rurapp-forest font-medium" data-testid="link-login">Entrar</Link></p>
            </form>
        </div>
    );
}
