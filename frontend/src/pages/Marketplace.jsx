import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ProductCard } from "../components/Cards";
import { Search, Filter, Leaf } from "lucide-react";

const CATEGORIES = ["Todas", "frutas", "verduras", "lácteos", "carnes", "animales", "derivados", "granos"];

export default function Marketplace() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState("Todas");
    const [search, setSearch] = useState("");
    const [location, setLocation] = useState("");

    useEffect(() => {
        const params = {};
        if (category !== "Todas") params.category = category;
        if (search) params.search = search;
        if (location) params.location = location;
        setLoading(true);
        api.get("/products", { params }).then((r) => setProducts(r.data)).finally(() => setLoading(false));
    }, [category, search, location]);

    return (
        <div className="container-rurapp py-8" data-testid="marketplace-page">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-rurapp-forest font-bold">Marketplace</p>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold text-rurapp-ink">Productos del campo</h1>
                    <p className="text-rurapp-inkSoft mt-1">Compra directo a campesinos colombianos</p>
                </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                    <input className="input-rurapp pl-10" placeholder="Busca papa, queso, mango…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="search-products" />
                </div>
                <div className="relative md:w-64">
                    <Filter className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                    <input className="input-rurapp pl-10" placeholder="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="search-location" />
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCategory(c)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${category === c ? "bg-rurapp-forest text-white border-rurapp-forest" : "bg-white text-rurapp-ink border-rurapp-edge hover:bg-rurapp-leaf"}`}
                        data-testid={`cat-${c}`}>{c}</button>
                ))}
            </div>
            {loading ? (
                <div className="text-center py-20 text-rurapp-inkMuted" data-testid="products-loading">Cargando productos…</div>
            ) : products.length === 0 ? (
                <div className="card-rurapp text-center py-16" data-testid="products-empty">
                    <Leaf className="h-12 w-12 mx-auto text-rurapp-forest mb-3" />
                    <h3 className="font-heading text-xl font-semibold">Aún no hay productos en esta búsqueda</h3>
                    <p className="text-rurapp-inkSoft mt-1">Pronto los campesinos publicarán productos frescos por aquí.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {products.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
            )}
        </div>
    );
}
