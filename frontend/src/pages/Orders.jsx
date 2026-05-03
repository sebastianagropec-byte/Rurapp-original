import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Package, Calendar } from "lucide-react";

const STATUS_LABEL = {
    pending_payment: "Pendiente de pago", paid: "Pagado", preparing: "Preparando",
    shipped: "En camino", delivered: "Entregado", cancelled: "Cancelado",
    confirmed: "Confirmada", completed: "Completada",
};

const STATUS_CLASS = {
    paid: "bg-rurapp-leaf text-rurapp-forest",
    confirmed: "bg-rurapp-leaf text-rurapp-forest",
    delivered: "bg-rurapp-leaf text-rurapp-forest",
    completed: "bg-rurapp-leaf text-rurapp-forest",
    pending_payment: "bg-rurapp-sand text-rurapp-earth2",
    cancelled: "bg-red-100 text-red-700",
};

export function MyOrders() {
    const [orders, setOrders] = useState([]);
    useEffect(() => { api.get("/orders/mine").then((r) => setOrders(r.data)); }, []);
    return (
        <div className="container-rurapp py-8" data-testid="my-orders-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Mis pedidos</h1>
            {orders.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes pedidos</div>
            ) : (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="card-rurapp" data-testid={`order-${o.id}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-rurapp-leaf flex items-center justify-center"><Package className="h-5 w-5 text-rurapp-forest" /></div>
                                    <div>
                                        <div className="font-heading font-semibold">Pedido #{o.id.slice(0, 8)}</div>
                                        <div className="text-xs text-rurapp-inkMuted">{new Date(o.created_at).toLocaleDateString("es-CO")} · {o.items.length} productos</div>
                                    </div>
                                </div>
                                <span className={`text-sm px-3 py-1 rounded-full ${STATUS_CLASS[o.status] || "bg-rurapp-sand"}`}>{STATUS_LABEL[o.status] || o.status}</span>
                            </div>
                            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-rurapp-inkSoft">
                                {o.items.map((it, i) => <div key={i}>· {it.product_name} ×{it.quantity}</div>)}
                            </div>
                            <div className="mt-3 flex justify-between items-center pt-3 border-t border-rurapp-edge">
                                <span className="text-rurapp-inkSoft text-sm">Entrega: {o.delivery_address}</span>
                                <span className="font-bold text-rurapp-forest text-lg">${o.total.toLocaleString("es-CO")}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function MyBookings() {
    const [bookings, setBookings] = useState([]);
    useEffect(() => { api.get("/bookings/mine").then((r) => setBookings(r.data)); }, []);
    return (
        <div className="container-rurapp py-8" data-testid="my-bookings-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Mis citas</h1>
            {bookings.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes citas agendadas</div>
            ) : (
                <div className="space-y-3">
                    {bookings.map((b) => (
                        <div key={b.id} className="card-rurapp" data-testid={`booking-${b.id}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-rurapp-leaf flex items-center justify-center"><Calendar className="h-5 w-5 text-rurapp-forest" /></div>
                                    <div>
                                        <div className="font-heading font-semibold">{b.service_title}</div>
                                        <div className="text-xs text-rurapp-inkMuted">{b.expert_name} · {new Date(b.scheduled_at).toLocaleString("es-CO")}</div>
                                    </div>
                                </div>
                                <span className={`text-sm px-3 py-1 rounded-full ${STATUS_CLASS[b.status] || "bg-rurapp-sand"}`}>{STATUS_LABEL[b.status] || b.status}</span>
                            </div>
                            <div className="mt-3 flex justify-between pt-3 border-t border-rurapp-edge">
                                {b.notes && <span className="text-rurapp-inkSoft text-sm">Notas: {b.notes}</span>}
                                <span className="font-bold text-rurapp-forest ml-auto">${b.price.toLocaleString("es-CO")}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ReceivedOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    useEffect(() => { api.get("/orders/received").then((r) => setOrders(r.data)); }, []);
    if (user?.role !== "productor") return <div className="container-rurapp py-20">Solo productores</div>;
    return (
        <div className="container-rurapp py-8" data-testid="received-orders-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Pedidos recibidos</h1>
            {orders.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes pedidos recibidos</div>
            ) : (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <div key={o.id} className="card-rurapp" data-testid={`recv-order-${o.id}`}>
                            <div className="flex items-center justify-between">
                                <div className="font-heading font-semibold">{o.customer_name}</div>
                                <span className={`text-sm px-3 py-1 rounded-full ${STATUS_CLASS[o.status] || "bg-rurapp-sand"}`}>{STATUS_LABEL[o.status] || o.status}</span>
                            </div>
                            <div className="text-sm text-rurapp-inkSoft mt-1">{o.delivery_address}</div>
                            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
                                {o.items.filter((it) => it.producer_id === user.id).map((it, i) => <div key={i}>· {it.product_name} ×{it.quantity} · ${it.subtotal.toLocaleString("es-CO")}</div>)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ReceivedBookings() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    useEffect(() => { api.get("/bookings/received").then((r) => setBookings(r.data)); }, []);
    if (user?.role !== "veterinario") return <div className="container-rurapp py-20">Solo expertos</div>;
    return (
        <div className="container-rurapp py-8" data-testid="received-bookings-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Citas recibidas</h1>
            {bookings.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes citas</div>
            ) : (
                <div className="space-y-3">
                    {bookings.map((b) => (
                        <div key={b.id} className="card-rurapp" data-testid={`recv-booking-${b.id}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-heading font-semibold">{b.service_title}</div>
                                    <div className="text-sm text-rurapp-inkSoft">Cliente: {b.customer_name} · {new Date(b.scheduled_at).toLocaleString("es-CO")}</div>
                                </div>
                                <span className={`text-sm px-3 py-1 rounded-full ${STATUS_CLASS[b.status] || "bg-rurapp-sand"}`}>{STATUS_LABEL[b.status] || b.status}</span>
                            </div>
                            {b.notes && <div className="mt-2 text-rurapp-inkSoft text-sm">{b.notes}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
