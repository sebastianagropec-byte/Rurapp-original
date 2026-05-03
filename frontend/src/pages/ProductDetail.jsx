import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { Star, MapPin, Leaf, ShoppingBasket, ArrowLeft, User } from "lucide-react";

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem } = useCart();
    const { user } = useAuth();
    const [product, setProduct] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [qty, setQty] = useState(1);
    const [reviewText, setReviewText] = useState("");
    const [rating, setRating] = useState(5);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get(`/products/${id}`),
            api.get(`/reviews`, { params: { target_type: "product", target_id: id } }),
        ]).then(([p, r]) => { setProduct(p.data); setReviews(r.data); }).finally(() => setLoading(false));
    }, [id]);

    const submitReview = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/login");
        await api.post("/reviews", { target_type: "product", target_id: id, rating, comment: reviewText });
        setReviewText("");
        const r = await api.get(`/reviews`, { params: { target_type: "product", target_id: id } });
        setReviews(r.data);
        const p = await api.get(`/products/${id}`);
        setProduct(p.data);
    };

    if (loading) return <div className="container-rurapp py-20 text-center text-rurapp-inkMuted">Cargando…</div>;
    if (!product) return <div className="container-rurapp py-20">Producto no encontrado</div>;

    return (
        <div className="container-rurapp py-6" data-testid="product-detail">
            <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-rurapp-forest" data-testid="back-btn"><ArrowLeft className="h-4 w-4" /> Volver</button>
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="rounded-3xl overflow-hidden bg-rurapp-sand h-[420px] border border-rurapp-edge">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-rurapp-inkMuted"><Leaf className="h-12 w-12" /></div>}
                </div>
                <div>
                    <span className="chip">{product.category}</span>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold text-rurapp-ink mt-2">{product.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-sm text-rurapp-inkSoft">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {product.producer_location || "Colombia"}</span>
                        <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-rurapp-earth text-rurapp-earth" /> {product.rating_avg?.toFixed(1) || "Nuevo"} ({product.rating_count})</span>
                    </div>
                    <p className="mt-4 text-rurapp-inkSoft text-lg">{product.description}</p>
                    <div className="mt-6 flex items-end gap-2">
                        <div className="text-4xl font-bold text-rurapp-forest">${product.price.toLocaleString("es-CO")}</div>
                        <div className="text-rurapp-inkMuted">/{product.unit}</div>
                    </div>
                    <div className="mt-2 text-sm text-rurapp-inkSoft">Disponible: <span className="font-semibold text-rurapp-ink">{product.stock} {product.unit}</span></div>
                    <div className="mt-6 flex items-center gap-3">
                        <div className="inline-flex items-center border border-rurapp-edge rounded-xl overflow-hidden">
                            <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3 text-lg" data-testid="qty-minus">−</button>
                            <span className="px-4 py-3 min-w-[3rem] text-center font-semibold" data-testid="qty-value">{qty}</span>
                            <button onClick={() => setQty(qty + 1)} className="px-4 py-3 text-lg" data-testid="qty-plus">+</button>
                        </div>
                        <button onClick={() => { addItem(product, qty); navigate("/cart"); }} className="btn-primary inline-flex items-center gap-2 flex-1" data-testid="add-to-cart">
                            <ShoppingBasket className="h-5 w-5" /> Agregar al carrito
                        </button>
                    </div>

                    {/* Producer */}
                    <Link to={`/perfil/${product.producer_id}`} className="mt-6 card-rurapp flex items-center gap-3" data-testid="producer-link">
                        <div className="h-12 w-12 rounded-full bg-rurapp-leaf flex items-center justify-center text-rurapp-forest"><User className="h-6 w-6" /></div>
                        <div>
                            <div className="text-xs uppercase tracking-widest text-rurapp-inkMuted">Productor</div>
                            <div className="font-heading font-semibold">{product.producer_name}</div>
                        </div>
                    </Link>

                    {(product.sustainable_practices || []).length > 0 && (
                        <div className="mt-4">
                            <h3 className="font-heading font-semibold mb-2">Prácticas sostenibles</h3>
                            <div className="flex flex-wrap gap-2">
                                {product.sustainable_practices.map((s, i) => <span key={i} className="chip"><Leaf className="h-3 w-3 mr-1" />{s}</span>)}
                            </div>
                        </div>
                    )}

                    {product.origin_story && (
                        <div className="mt-4 card-rurapp bg-rurapp-leaf/40">
                            <h3 className="font-heading font-semibold mb-2">Trazabilidad y origen</h3>
                            <p className="text-rurapp-inkSoft">{product.origin_story}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Reviews */}
            <section className="mt-12">
                <h2 className="font-heading text-2xl font-bold mb-4">Reseñas ({reviews.length})</h2>
                {user && (
                    <form onSubmit={submitReview} className="card-rurapp mb-6 space-y-3" data-testid="review-form">
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button type="button" key={n} onClick={() => setRating(n)} data-testid={`star-${n}`}>
                                    <Star className={`h-6 w-6 ${n <= rating ? "fill-rurapp-earth text-rurapp-earth" : "text-rurapp-edge"}`} />
                                </button>
                            ))}
                        </div>
                        <textarea className="input-rurapp" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Comparte tu experiencia con este producto" data-testid="review-text" />
                        <button className="btn-primary" data-testid="submit-review">Enviar reseña</button>
                    </form>
                )}
                <div className="space-y-3">
                    {reviews.map((r) => (
                        <div key={r.id} className="card-rurapp" data-testid={`review-${r.id}`}>
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">{r.author_name}</div>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-rurapp-earth text-rurapp-earth" : "text-rurapp-edge"}`} />)}
                                </div>
                            </div>
                            {r.comment && <p className="text-rurapp-inkSoft mt-2">{r.comment}</p>}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
