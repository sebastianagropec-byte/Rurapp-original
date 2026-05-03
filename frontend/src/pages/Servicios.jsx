import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ServiceCard } from "../components/Cards";
import { Search, Filter, Stethoscope } from "lucide-react";

const CATEGORIES = ["Todas", "consulta_virtual", "asesoria_tecnica", "visita_finca", "capacitacion"];

export default function Servicios() {
    const [services, setServices] = useState([]);
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
        api.get("/services", { params }).then((r) => setServices(r.data)).finally(() => setLoading(false));
    }, [category, search, location]);

    return (
        <div className="container-rurapp py-8" data-testid="services-page">
            <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.2em] text-rurapp-earth2 font-bold">Servicios profesionales</p>
                <h1 className="font-heading text-3xl md:text-4xl font-bold text-rurapp-ink">Veterinarios y asesores del campo</h1>
                <p className="text-rurapp-inkSoft mt-1">Agenda consultas y visitas con expertos verificados</p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                    <input className="input-rurapp pl-10" placeholder="Busca consulta, ganado, cultivos…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="search-services" />
                </div>
                <div className="relative md:w-64">
                    <Filter className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rurapp-inkMuted" />
                    <input className="input-rurapp pl-10" placeholder="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="search-services-location" />
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCategory(c)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${category === c ? "bg-rurapp-forest text-white border-rurapp-forest" : "bg-white text-rurapp-ink border-rurapp-edge hover:bg-rurapp-leaf"}`}
                        data-testid={`scat-${c}`}>{c.replace("_", " ")}</button>
                ))}
            </div>
            {loading ? (
                <div className="text-center py-20 text-rurapp-inkMuted" data-testid="services-loading">Cargando servicios…</div>
            ) : services.length === 0 ? (
                <div className="card-rurapp text-center py-16" data-testid="services-empty">
                    <Stethoscope className="h-12 w-12 mx-auto text-rurapp-forest mb-3" />
                    <h3 className="font-heading text-xl font-semibold">Aún no hay servicios en esta categoría</h3>
                    <p className="text-rurapp-inkSoft mt-1">Pronto los expertos del campo publicarán aquí sus servicios.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map((s) => <ServiceCard key={s.id} service={s} />)}
                </div>
            )}
        </div>
    );
}
