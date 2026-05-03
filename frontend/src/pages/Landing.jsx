import { Link } from "react-router-dom";
import { Sprout, Stethoscope, Heart, MapPin, ShoppingBasket, ShieldCheck, Sparkles, Users, Leaf, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ProductCard, ServiceCard } from "../components/Cards";

const HERO_IMG = "https://images.unsplash.com/photo-1721594489120-880ba23d61dd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxmYXJtZXIlMjBhZ3JpY3VsdHVyZSUyMGhhcnZlc3R8ZW58MHx8fHwxNzc3ODIzMTA0fDA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);

    useEffect(() => {
        api.get("/products").then((r) => setProducts(r.data.slice(0, 4))).catch(() => {});
        api.get("/services").then((r) => setServices(r.data.slice(0, 3))).catch(() => {});
    }, []);

    return (
        <div data-testid="landing-page">
            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="container-rurapp grid lg:grid-cols-12 gap-8 lg:gap-12 py-10 md:py-16 items-center">
                    <div className="lg:col-span-6 animate-fade-up">
                        <span className="chip mb-4"><Leaf className="h-3 w-3 mr-1" /> AgTech para Colombia</span>
                        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-rurapp-ink leading-[1.05]">
                            Del campo a tu mesa, <span className="text-rurapp-forest">sin intermediarios</span>.
                        </h1>
                        <p className="mt-5 text-lg text-rurapp-inkSoft max-w-xl">
                            Rurapp conecta a campesinos, veterinarios y consumidores urbanos. Compra productos frescos, agenda asesorías técnicas y apoya el campo colombiano con una app sencilla.
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2" data-testid="hero-cta-marketplace">
                                <ShoppingBasket className="h-5 w-5" /> Comprar productos del campo
                            </Link>
                            <Link to="/servicios" className="btn-outline inline-flex items-center gap-2" data-testid="hero-cta-services">
                                <Stethoscope className="h-5 w-5" /> Buscar un experto
                            </Link>
                        </div>
                        <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-rurapp-inkSoft">
                            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-rurapp-forest" /> Pagos seguros</div>
                            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-rurapp-forest" /> Comunidad rural</div>
                            <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-rurapp-earth" /> Comercio justo</div>
                        </div>
                    </div>
                    <div className="lg:col-span-6 relative">
                        <div className="relative rounded-3xl overflow-hidden border border-rurapp-edge shadow-lg">
                            <img src={HERO_IMG} alt="Campo colombiano" className="w-full h-[420px] object-cover" />
                            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-2xl p-4 border border-rurapp-edge">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-rurapp-inkMuted">Comunidad Rurapp</p>
                                        <p className="font-heading text-xl font-semibold text-rurapp-ink">+1.200 productores y expertos</p>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {["#2D5A27", "#D4A373", "#21431D"].map((c, i) => (
                                            <div key={i} className="h-10 w-10 rounded-full border-2 border-white" style={{ background: c }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* THREE PILLARS */}
            <section className="bg-rurapp-leaf/40 border-y border-rurapp-edge">
                <div className="container-rurapp py-12 grid md:grid-cols-3 gap-6">
                    {[
                        { icon: Sprout, title: "Productores campesinos", desc: "Vende directo, sin intermediarios. Cuenta tu historia y prácticas sostenibles." },
                        { icon: Stethoscope, title: "Veterinarios y expertos", desc: "Ofrece consultas, agenda visitas y comparte conocimiento con la comunidad." },
                        { icon: ShoppingBasket, title: "Familias en la ciudad", desc: "Compra fresco, conoce el origen y agenda servicios profesionales." },
                    ].map((p, i) => (
                        <div key={i} className="card-rurapp animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="h-12 w-12 rounded-xl bg-rurapp-forest text-white flex items-center justify-center mb-4">
                                <p.icon className="h-6 w-6" />
                            </div>
                            <h3 className="font-heading text-xl font-semibold text-rurapp-ink">{p.title}</h3>
                            <p className="text-rurapp-inkSoft mt-2">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* PRODUCTS */}
            {products.length > 0 && (
                <section className="container-rurapp py-12">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-rurapp-forest font-bold">Marketplace</p>
                            <h2 className="font-heading text-3xl font-semibold text-rurapp-ink">Productos frescos del campo</h2>
                        </div>
                        <Link to="/marketplace" className="text-rurapp-forest hover:underline inline-flex items-center gap-1" data-testid="see-all-products">Ver todos <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                </section>
            )}

            {/* SERVICES */}
            {services.length > 0 && (
                <section className="container-rurapp py-12">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-rurapp-earth2 font-bold">Servicios profesionales</p>
                            <h2 className="font-heading text-3xl font-semibold text-rurapp-ink">Asesorías y veterinarios</h2>
                        </div>
                        <Link to="/servicios" className="text-rurapp-forest hover:underline inline-flex items-center gap-1" data-testid="see-all-services">Ver todos <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {services.map((s) => <ServiceCard key={s.id} service={s} />)}
                    </div>
                </section>
            )}

            {/* MEMBERSHIP CTA */}
            <section className="container-rurapp py-12">
                <div className="rounded-3xl bg-rurapp-forest text-white p-8 md:p-12 grid md:grid-cols-2 gap-6 items-center">
                    <div>
                        <span className="chip-earth mb-4 inline-flex">Para productores y expertos</span>
                        <h2 className="font-heading text-3xl md:text-4xl font-bold">Hazte parte de Rurapp</h2>
                        <p className="text-white/80 mt-3 text-lg">
                            Publica tus productos o servicios y recibe pedidos directos de la ciudad. Membresía mensual desde $9.99.
                        </p>
                    </div>
                    <div className="flex md:justify-end">
                        <Link to="/register" className="btn-secondary inline-flex items-center gap-2" data-testid="cta-join">
                            <Sparkles className="h-5 w-5" /> Crear mi cuenta gratis
                        </Link>
                    </div>
                </div>
            </section>

            {/* IMPACT */}
            <section className="bg-white border-t border-rurapp-edge">
                <div className="container-rurapp py-12 grid md:grid-cols-4 gap-6">
                    {[
                        { n: "1.2K+", l: "Productores rurales" },
                        { n: "300+", l: "Veterinarios" },
                        { n: "15K+", l: "Familias urbanas" },
                        { n: "32", l: "Departamentos cubiertos" },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="font-heading text-4xl font-bold text-rurapp-forest">{s.n}</div>
                            <div className="text-rurapp-inkSoft mt-1">{s.l}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
