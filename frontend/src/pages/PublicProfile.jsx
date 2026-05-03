import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { ProductCard, ServiceCard } from "../components/Cards";
import { User, MapPin, Star, Leaf, ShieldCheck } from "lucide-react";

export default function PublicProfile() {
    const { id } = useParams();
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);

    useEffect(() => {
        api.get(`/users/${id}`).then((r) => {
            setUser(r.data);
            if (r.data.role === "productor") api.get("/products", { params: { producer_id: id } }).then((p) => setProducts(p.data));
            if (r.data.role === "veterinario") api.get("/services", { params: { expert_id: id } }).then((s) => setServices(s.data));
        });
    }, [id]);

    if (!user) return <div className="container-rurapp py-20 text-center">Cargando…</div>;

    return (
        <div className="container-rurapp py-8" data-testid="public-profile">
            <div className="card-rurapp flex flex-col md:flex-row gap-6 items-start">
                <div className="h-24 w-24 rounded-full bg-rurapp-forest flex items-center justify-center text-white flex-shrink-0">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <User className="h-12 w-12" />}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="font-heading text-3xl font-bold">{user.full_name}</h1>
                        {user.verified && <span className="chip"><ShieldCheck className="h-3 w-3 mr-1" /> Verificado</span>}
                        {user.membership_active && <span className="chip-earth">Pro</span>}
                    </div>
                    <div className="text-rurapp-inkSoft mt-1 capitalize">{user.role === "veterinario" ? "Experto del agro" : user.role}</div>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-rurapp-inkSoft">
                        {user.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {user.location}</span>}
                        {user.rating_count > 0 && <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-rurapp-earth text-rurapp-earth" /> {user.rating_avg?.toFixed(1)} ({user.rating_count})</span>}
                        {user.specialty && <span>{user.specialty}</span>}
                    </div>
                    {user.bio && <p className="text-rurapp-inkSoft mt-4 max-w-2xl">{user.bio}</p>}
                    {user.sustainable_practices?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {user.sustainable_practices.map((s, i) => <span key={i} className="chip"><Leaf className="h-3 w-3 mr-1" />{s}</span>)}
                        </div>
                    )}
                </div>
            </div>

            {products.length > 0 && (
                <section className="mt-10">
                    <h2 className="font-heading text-2xl font-bold mb-4">Productos</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                </section>
            )}
            {services.length > 0 && (
                <section className="mt-10">
                    <h2 className="font-heading text-2xl font-bold mb-4">Servicios</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {services.map((s) => <ServiceCard key={s.id} service={s} />)}
                    </div>
                </section>
            )}
        </div>
    );
}
