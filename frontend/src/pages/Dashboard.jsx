import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import {
    Sprout, Stethoscope, ShoppingBasket, Plus, Package, ClipboardList,
    Calendar, Sparkles, AlertTriangle, MapPin, Star
} from "lucide-react";

export default function Dashboard() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [orders, setOrders] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [received, setReceived] = useState([]);

    useEffect(() => {
        if (!user) return;
        if (user.role === "productor") {
            api.get("/products/mine").then((r) => setProducts(r.data)).catch(() => {});
            api.get("/orders/received").then((r) => setReceived(r.data)).catch(() => {});
        }
        if (user.role === "veterinario") {
            api.get("/services/mine").then((r) => setServices(r.data)).catch(() => {});
            api.get("/bookings/received").then((r) => setReceived(r.data)).catch(() => {});
        }
        api.get("/orders/mine").then((r) => setOrders(r.data)).catch(() => {});
        api.get("/bookings/mine").then((r) => setBookings(r.data)).catch(() => {});
    }, [user]);

    if (!user) return <div className="container-rurapp py-20 text-center">Inicia sesión</div>;

    const greet = user.role === "productor" ? "Tu finca" : user.role === "veterinario" ? "Tu consultorio" : "Tu cuenta";

    return (
        <div className="container-rurapp py-8" data-testid="dashboard-page">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-rurapp-forest font-bold">{greet}</p>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold">Hola, {user.full_name?.split(" ")[0]} 👋</h1>
                    <p className="text-rurapp-inkSoft flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" /> {user.location || "Colombia"}
                        {user.rating_count > 0 && (
                            <span className="ml-3 inline-flex items-center gap-1"><Star className="h-4 w-4 fill-rurapp-earth text-rurapp-earth" /> {user.rating_avg?.toFixed(1)}</span>
                        )}
                    </p>
                </div>
                <Link to="/perfil" className="btn-outline" data-testid="edit-profile-btn">Editar perfil</Link>
            </div>

            {/* Membership warning */}
            {(user.role === "productor" || user.role === "veterinario") && !user.membership_active && (
                <div className="mb-6 card-rurapp bg-rurapp-earth/10 border-rurapp-earth flex items-start gap-3" data-testid="membership-warning">
                    <AlertTriangle className="h-6 w-6 text-rurapp-earth2 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-heading font-semibold">Activa tu membresía</h3>
                        <p className="text-rurapp-inkSoft text-sm mt-1">Necesitas un plan activo para publicar {user.role === "productor" ? "productos" : "servicios"}.</p>
                    </div>
                    <Link to="/membresia" className="btn-primary text-sm" data-testid="goto-membership">Ver planes</Link>
                </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {user.role === "productor" && <StatCard icon={Package} label="Productos" value={products.length} link="/mis-productos" testId="stat-products" />}
                {user.role === "veterinario" && <StatCard icon={Stethoscope} label="Servicios" value={services.length} link="/mis-servicios" testId="stat-services" />}
                {(user.role === "productor" || user.role === "veterinario") && <StatCard icon={ClipboardList} label="Recibidos" value={received.length} link={user.role === "productor" ? "/pedidos-recibidos" : "/citas-recibidas"} testId="stat-received" />}
                <StatCard icon={ShoppingBasket} label="Mis pedidos" value={orders.length} link="/mis-pedidos" testId="stat-orders" />
                <StatCard icon={Calendar} label="Mis citas" value={bookings.length} link="/mis-citas" testId="stat-bookings" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {user.role === "productor" && (
                    <div className="lg:col-span-2 card-rurapp">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-heading text-xl font-semibold flex items-center gap-2"><Sprout className="h-5 w-5 text-rurapp-forest" /> Mis productos</h2>
                            <Link to="/mis-productos/nuevo" className="btn-primary text-sm inline-flex items-center gap-1" data-testid="add-product-btn"><Plus className="h-4 w-4" /> Nuevo</Link>
                        </div>
                        {products.length === 0 ? (
                            <div className="text-center py-8 text-rurapp-inkMuted">Aún no has publicado productos</div>
                        ) : (
                            <div className="space-y-2">
                                {products.slice(0, 5).map((p) => (
                                    <Link key={p.id} to={`/producto/${p.id}`} className="flex items-center justify-between py-2 border-b border-rurapp-edge last:border-0">
                                        <span className="font-medium">{p.name}</span>
                                        <span className="text-rurapp-forest font-semibold">${p.price}/{p.unit}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {user.role === "veterinario" && (
                    <div className="lg:col-span-2 card-rurapp">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-heading text-xl font-semibold flex items-center gap-2"><Stethoscope className="h-5 w-5 text-rurapp-forest" /> Mis servicios</h2>
                            <Link to="/mis-servicios/nuevo" className="btn-primary text-sm inline-flex items-center gap-1" data-testid="add-service-btn"><Plus className="h-4 w-4" /> Nuevo</Link>
                        </div>
                        {services.length === 0 ? (
                            <div className="text-center py-8 text-rurapp-inkMuted">Aún no has publicado servicios</div>
                        ) : (
                            <div className="space-y-2">
                                {services.slice(0, 5).map((s) => (
                                    <Link key={s.id} to={`/servicio/${s.id}`} className="flex items-center justify-between py-2 border-b border-rurapp-edge last:border-0">
                                        <span className="font-medium">{s.title}</span>
                                        <span className="text-rurapp-forest font-semibold">${s.price}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {user.role === "cliente" && (
                    <div className="lg:col-span-2 card-rurapp">
                        <h2 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-rurapp-forest" /> Tus últimos pedidos</h2>
                        {orders.length === 0 ? (
                            <div className="text-center py-8 text-rurapp-inkMuted">Aún no tienes pedidos</div>
                        ) : (
                            <div className="space-y-2">
                                {orders.slice(0, 5).map((o) => (
                                    <div key={o.id} className="flex items-center justify-between py-2 border-b border-rurapp-edge last:border-0">
                                        <span className="font-medium">{o.items.length} productos</span>
                                        <span className={`text-sm px-2 py-1 rounded-full ${o.status === "paid" || o.status === "delivered" ? "bg-rurapp-leaf text-rurapp-forest" : "bg-rurapp-sand text-rurapp-earth2"}`}>{o.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="card-rurapp bg-rurapp-forest text-white">
                    <Sparkles className="h-8 w-8 mb-2" />
                    <h3 className="font-heading text-xl font-semibold">Pregunta a Rura IA</h3>
                    <p className="text-white/80 mt-1 text-sm">Asistente experto en agro y veterinaria, en español.</p>
                    <Link to="/asistente" className="btn-secondary inline-flex items-center gap-2 mt-4" data-testid="cta-ai">Conversar</Link>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, link, testId }) {
    return (
        <Link to={link} className="card-rurapp hover:-translate-y-0.5 transition-transform" data-testid={testId}>
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rurapp-leaf flex items-center justify-center text-rurapp-forest">
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <div className="text-xs uppercase tracking-widest text-rurapp-inkMuted">{label}</div>
                    <div className="font-heading text-2xl font-bold">{value}</div>
                </div>
            </div>
        </Link>
    );
}
