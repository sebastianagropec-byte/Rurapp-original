import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Sprout, Mail, Lock, AlertCircle } from "lucide-react";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            await login(email, password);
            navigate(location.state?.from || "/dashboard");
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos iniciar sesión");
        } finally { setLoading(false); }
    };

    return (
        <div className="container-rurapp py-10 md:py-16 max-w-md" data-testid="login-page">
            <div className="text-center mb-8">
                <div className="inline-flex h-14 w-14 rounded-2xl bg-rurapp-forest items-center justify-center mb-3">
                    <Sprout className="h-7 w-7 text-white" />
                </div>
                <h1 className="font-heading text-3xl font-bold text-rurapp-ink">Bienvenido de vuelta</h1>
                <p className="text-rurapp-inkSoft mt-1">Entra a tu cuenta de Rurapp</p>
            </div>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                {err && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200" data-testid="login-error"><AlertCircle className="h-4 w-4" /><span className="text-sm">{err}</span></div>}
                <label className="block">
                    <span className="text-sm font-medium text-rurapp-ink">Correo</span>
                    <div className="relative mt-1">
                        <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-rurapp pl-10" placeholder="tu@correo.com" data-testid="login-email" />
                    </div>
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-rurapp-ink">Contraseña</span>
                    <div className="relative mt-1">
                        <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-rurapp pl-10" placeholder="••••••••" data-testid="login-password" />
                    </div>
                </label>
                <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit">{loading ? "Entrando…" : "Entrar"}</button>
                <p className="text-center text-sm text-rurapp-inkSoft">¿Aún no tienes cuenta? <Link to="/register" className="text-rurapp-forest font-medium" data-testid="link-register">Crear cuenta</Link></p>
            </form>
        </div>
    );
}
