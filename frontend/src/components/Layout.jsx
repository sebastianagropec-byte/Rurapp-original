import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import {
    Home, Sprout, Stethoscope, BookOpen, ShoppingBasket,
    User, MessageCircle, LogOut, Menu, X, MapPin
} from "lucide-react";
import { useState } from "react";
import { InstallBanner, OfflineBanner } from "./InstallBanner";

export function TopBar() {
    const { user, logout } = useAuth();
    const { count } = useCart();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 bg-rurapp-bone/95 backdrop-blur border-b border-rurapp-edge">
            <div className="container-rurapp flex items-center justify-between py-3">
                <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
                    <div className="h-9 w-9 rounded-xl bg-rurapp-forest flex items-center justify-center">
                        <Sprout className="h-5 w-5 text-white" />
                    </div>
                    <div className="leading-tight">
                        <div className="font-heading text-xl font-bold text-rurapp-forest">Rurapp</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-rurapp-inkMuted">Del campo a tu mesa</div>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-2">
                    <Link to="/marketplace" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-marketplace">Productos</Link>
                    <Link to="/servicios" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-services">Servicios</Link>
                    <Link to="/mapa" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-map">Mapa</Link>
                    <Link to="/contenido" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-articles">Contenido</Link>
                    <Link to="/asistente" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-ai">Asistente</Link>
                    {user && <Link to="/chat" className="px-3 py-2 text-rurapp-ink hover:text-rurapp-forest font-medium" data-testid="nav-chat">Chat</Link>}
                </nav>

                <div className="flex items-center gap-2">
                    <Link to="/cart" className="relative inline-flex items-center justify-center h-11 w-11 rounded-xl border border-rurapp-edge hover:bg-rurapp-leaf" data-testid="nav-cart">
                        <ShoppingBasket className="h-5 w-5 text-rurapp-forest" />
                        {count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-rurapp-earth text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center" data-testid="cart-badge">{count}</span>
                        )}
                    </Link>
                    {user ? (
                        <>
                            <Link to="/dashboard" className="hidden sm:inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-rurapp-leaf text-rurapp-forest font-medium hover:bg-rurapp-edge" data-testid="nav-dashboard">
                                <User className="h-4 w-4" />
                                <span className="text-sm">{user.full_name?.split(" ")[0]}</span>
                            </Link>
                            <button onClick={() => { logout(); navigate("/"); }} className="hidden sm:inline-flex items-center justify-center h-11 w-11 rounded-xl border border-rurapp-edge hover:bg-rurapp-leaf" title="Salir" data-testid="nav-logout">
                                <LogOut className="h-5 w-5 text-rurapp-ink" />
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="hidden sm:inline-flex items-center px-4 h-11 rounded-xl text-rurapp-forest hover:bg-rurapp-leaf font-medium" data-testid="nav-login">Entrar</Link>
                            <Link to="/register" className="hidden sm:inline-flex items-center px-4 h-11 rounded-xl bg-rurapp-forest text-white hover:bg-rurapp-forest2 font-medium" data-testid="nav-register">Registro</Link>
                        </>
                    )}
                    <button className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-xl border border-rurapp-edge" onClick={() => setMenuOpen(!menuOpen)} data-testid="mobile-menu-btn">
                        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            {menuOpen && (
                <div className="md:hidden border-t border-rurapp-edge bg-white">
                    <div className="container-rurapp py-2 flex flex-col">
                        <Link to="/marketplace" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-marketplace">Productos</Link>
                        <Link to="/servicios" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-services">Servicios</Link>
                        <Link to="/mapa" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-map">Mapa</Link>
                        <Link to="/contenido" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-articles">Contenido</Link>
                        <Link to="/asistente" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-ai">Asistente Rura</Link>
                        {user && <Link to="/chat" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-chat">Chat</Link>}
                        {user ? (
                            <>
                                <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-dashboard">Mi cuenta</Link>
                                <button onClick={() => { logout(); setMenuOpen(false); navigate("/"); }} className="py-3 text-left font-medium" data-testid="mnav-logout">Salir</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" onClick={() => setMenuOpen(false)} className="py-3 font-medium" data-testid="mnav-login">Entrar</Link>
                                <Link to="/register" onClick={() => setMenuOpen(false)} className="py-3 font-medium text-rurapp-forest" data-testid="mnav-register">Crear cuenta</Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

export function BottomNav() {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const items = [
        { to: "/", icon: Home, label: "Inicio", testId: "bottom-home" },
        { to: "/marketplace", icon: Sprout, label: "Productos", testId: "bottom-marketplace" },
        { to: "/servicios", icon: Stethoscope, label: "Servicios", testId: "bottom-services" },
        { to: "/asistente", icon: MessageCircle, label: "Rura IA", testId: "bottom-ai" },
        { to: user ? "/dashboard" : "/login", icon: User, label: user ? "Cuenta" : "Entrar", testId: "bottom-account" },
    ];
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-rurapp-edge z-40 pb-safe">
            <div className="grid grid-cols-5">
                {items.map(({ to, icon: Icon, label, testId }) => {
                    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
                    return (
                        <Link key={to} to={to} className={`py-2.5 flex flex-col items-center justify-center gap-1 ${active ? "text-rurapp-forest" : "text-rurapp-inkMuted"}`} data-testid={testId}>
                            <Icon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

export function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-rurapp-bone">
            <OfflineBanner />
            <TopBar />
            <main className="flex-1 pb-24 md:pb-12">{children}</main>
            <BottomNav />
            <InstallBanner />
            <footer className="hidden md:block border-t border-rurapp-edge bg-white">
                <div className="container-rurapp py-8 text-sm text-rurapp-inkMuted flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Sprout className="h-4 w-4 text-rurapp-forest" />
                        <span>Rurapp · Conectando el campo y la ciudad · Hecho en Colombia</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/membresia" className="hover:text-rurapp-forest" data-testid="footer-membership">Planes para campesinos</Link>
                        <Link to="/contenido" className="hover:text-rurapp-forest" data-testid="footer-articles">Conocimiento</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
