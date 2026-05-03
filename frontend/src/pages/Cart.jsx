import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ShoppingBasket, Trash2, ArrowRight } from "lucide-react";
import PaymentProviderSelector from "../components/PaymentProviderSelector";

export default function Cart() {
    const { items, updateQty, removeItem, total, clear } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [provider, setProvider] = useState("stripe");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const onCheckout = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/login", { state: { from: "/cart" } });
        if (items.length === 0) return;
        setErr(""); setLoading(true);
        try {
            const { data } = await api.post("/orders", {
                items: items.map(({ product_id, quantity }) => ({ product_id, quantity })),
                delivery_address: address,
                notes,
                origin_url: window.location.origin,
                payment_provider: provider,
            });
            clear();
            window.location.href = data.checkout_url;
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos crear el pedido");
            setLoading(false);
        }
    };

    return (
        <div className="container-rurapp py-8 max-w-4xl" data-testid="cart-page">
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-6">Mi carrito</h1>
            {items.length === 0 ? (
                <div className="card-rurapp text-center py-16" data-testid="cart-empty">
                    <ShoppingBasket className="h-12 w-12 mx-auto text-rurapp-forest mb-3" />
                    <h2 className="font-heading text-xl font-semibold">Tu carrito está vacío</h2>
                    <p className="text-rurapp-inkSoft mt-1">Explora productos del campo</p>
                    <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2 mt-5" data-testid="go-marketplace">
                        Ver productos <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                        {items.map((it) => (
                            <div key={it.product_id} className="card-rurapp flex gap-4" data-testid={`cart-item-${it.product_id}`}>
                                <div className="h-20 w-20 rounded-xl bg-rurapp-sand overflow-hidden flex-shrink-0">
                                    {it.image_url && <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between gap-2">
                                        <div>
                                            <h3 className="font-heading font-semibold">{it.name}</h3>
                                            <p className="text-sm text-rurapp-inkMuted">{it.producer_name}</p>
                                        </div>
                                        <button onClick={() => removeItem(it.product_id)} className="text-rurapp-inkMuted hover:text-red-600" data-testid={`remove-${it.product_id}`}><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="inline-flex items-center border border-rurapp-edge rounded-xl overflow-hidden">
                                            <button onClick={() => updateQty(it.product_id, it.quantity - 1)} className="px-3 py-1.5">−</button>
                                            <span className="px-3 py-1.5 min-w-[2rem] text-center text-sm font-semibold">{it.quantity}</span>
                                            <button onClick={() => updateQty(it.product_id, it.quantity + 1)} className="px-3 py-1.5">+</button>
                                        </div>
                                        <div className="font-bold text-rurapp-forest">${(it.price * it.quantity).toLocaleString("es-CO")}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div>
                        <form onSubmit={onCheckout} className="card-rurapp space-y-4 sticky top-24" data-testid="checkout-form">
                            <div>
                                <div className="flex justify-between text-rurapp-inkSoft"><span>Subtotal</span><span>${total.toLocaleString("es-CO")}</span></div>
                                <div className="flex justify-between mt-2 font-heading text-xl font-bold"><span>Total</span><span className="text-rurapp-forest">${total.toLocaleString("es-CO")}</span></div>
                            </div>
                            {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="checkout-error">{err}</div>}
                            <label className="block">
                                <span className="text-sm font-medium">Dirección de entrega</span>
                                <input required className="input-rurapp mt-1" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, ciudad, barrio" data-testid="checkout-address" />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium">Notas</span>
                                <textarea rows={2} className="input-rurapp mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones extra" data-testid="checkout-notes" />
                            </label>
                            <PaymentProviderSelector value={provider} onChange={setProvider} dataTestPrefix="cart-pp" />
                            <button disabled={loading} className="btn-primary w-full" data-testid="checkout-submit">{loading ? "Procesando…" : "Pagar"}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
