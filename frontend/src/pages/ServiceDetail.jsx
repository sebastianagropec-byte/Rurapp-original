import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Star, MapPin, ArrowLeft, Calendar, Clock, User, ShieldCheck } from "lucide-react";
import PaymentProviderSelector from "../components/PaymentProviderSelector";
import { StartChatButton } from "./Chat";

export default function ServiceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [service, setService] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [scheduledAt, setScheduledAt] = useState("");
    const [notes, setNotes] = useState("");
    const [provider, setProvider] = useState("stripe");
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get(`/services/${id}`),
            api.get(`/reviews`, { params: { target_type: "service", target_id: id } }),
        ]).then(([s, r]) => { setService(s.data); setReviews(r.data); }).finally(() => setLoading(false));
    }, [id]);

    const onBook = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/login", { state: { from: `/servicio/${id}` } });
        if (!scheduledAt) return setErr("Selecciona fecha y hora");
        setErr(""); setBooking(true);
        try {
            const { data } = await api.post("/bookings", {
                service_id: id,
                scheduled_at: new Date(scheduledAt).toISOString(),
                notes,
                origin_url: window.location.origin,
                payment_provider: provider,
            });
            window.location.href = data.checkout_url;
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos crear la cita");
        } finally { setBooking(false); }
    };

    if (loading) return <div className="container-rurapp py-20 text-center text-rurapp-inkMuted">Cargando…</div>;
    if (!service) return <div className="container-rurapp py-20">Servicio no encontrado</div>;

    return (
        <div className="container-rurapp py-6" data-testid="service-detail">
            <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-rurapp-forest" data-testid="back-btn"><ArrowLeft className="h-4 w-4" /> Volver</button>
            <div className="grid lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3">
                    <div className="rounded-3xl overflow-hidden bg-rurapp-leaf h-72 border border-rurapp-edge">
                        {service.image_url ? <img src={service.image_url} alt={service.title} className="w-full h-full object-cover" /> : (
                            <div className="h-full flex items-center justify-center text-rurapp-forest font-heading text-3xl">Servicio profesional</div>
                        )}
                    </div>
                    <span className="chip-earth mt-4 inline-flex">{service.category?.replace("_", " ")}</span>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold text-rurapp-ink mt-2">{service.title}</h1>
                    <div className="flex items-center gap-4 mt-2 text-sm text-rurapp-inkSoft">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {service.expert_location || "Colombia"}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {service.duration_minutes} minutos</span>
                        <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-rurapp-earth text-rurapp-earth" /> {service.rating_avg?.toFixed(1) || "Nuevo"}</span>
                    </div>
                    <p className="mt-4 text-rurapp-inkSoft text-lg">{service.description}</p>
                    <div className="mt-6 card-rurapp flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-rurapp-forest flex items-center justify-center text-white"><User className="h-6 w-6" /></div>
                        <div>
                            <div className="text-xs uppercase tracking-widest text-rurapp-inkMuted">Experto</div>
                            <div className="font-heading font-semibold">{service.expert_name}</div>
                            {service.expert_specialty && <div className="text-sm text-rurapp-inkSoft">{service.expert_specialty}</div>}
                        </div>
                    </div>

                    <h2 className="font-heading text-2xl font-bold mt-10 mb-4">Reseñas ({reviews.length})</h2>
                    <div className="space-y-3">
                        {reviews.map((r) => (
                            <div key={r.id} className="card-rurapp">
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold">{r.author_name}</div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-rurapp-earth text-rurapp-earth" : "text-rurapp-edge"}`} />)}
                                    </div>
                                </div>
                                {r.comment && <p className="text-rurapp-inkSoft mt-2">{r.comment}</p>}
                            </div>
                        ))}
                        {reviews.length === 0 && <p className="text-rurapp-inkMuted">Aún no hay reseñas</p>}
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="card-rurapp sticky top-24">
                        <div className="text-rurapp-inkMuted text-sm">Precio del servicio</div>
                        <div className="text-4xl font-bold text-rurapp-forest mt-1">${service.price.toLocaleString("es-CO")}</div>
                        <form onSubmit={onBook} className="mt-5 space-y-3" data-testid="booking-form">
                            {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="booking-error">{err}</div>}
                            <label className="block">
                                <span className="text-sm font-medium">Fecha y hora</span>
                                <input type="datetime-local" required className="input-rurapp mt-1" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} data-testid="booking-datetime" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium">Notas para el experto</span>
                                <textarea rows={3} className="input-rurapp mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cuéntale al experto el motivo de la consulta" data-testid="booking-notes" />
                            </label>
                            <PaymentProviderSelector value={provider} onChange={setProvider} dataTestPrefix="srv-pp" />
                            <button type="submit" disabled={booking} className="btn-primary w-full inline-flex items-center justify-center gap-2" data-testid="book-now">
                                <Calendar className="h-5 w-5" /> {booking ? "Procesando…" : "Agendar y pagar"}
                            </button>
                            <p className="text-xs text-rurapp-inkMuted text-center">Pago seguro. Tu cita se confirma al completar el pago.</p>
                        </form>
                        <div className="mt-3">
                            <StartChatButton otherUserId={service.expert_id} label={`Mensaje a ${service.expert_name?.split(" ")[0] || "experto"}`} className="btn-outline w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
