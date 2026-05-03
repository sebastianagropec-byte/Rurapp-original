import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RurappMap } from "../components/RurappMap";
import { MapPin, Users } from "lucide-react";

export default function MapaPage() {
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        Promise.all([
            api.get("/users", { params: { role: "productor" } }),
            api.get("/users", { params: { role: "veterinario" } }),
        ]).then(([p, v]) => setUsers([...p.data, ...v.data]));
    }, []);

    const filtered = users.filter((u) => filter === "all" || u.role === filter);

    return (
        <div className="container-rurapp py-8" data-testid="map-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-rurapp-forest font-bold">Mapa</p>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold">Productores y expertos cerca de ti</h1>
                    <p className="text-rurapp-inkSoft mt-1 flex items-center gap-1"><MapPin className="h-4 w-4" /> Explora el campo colombiano</p>
                </div>
                <div className="flex gap-2">
                    {[
                        { v: "all", l: "Todos" },
                        { v: "productor", l: "Productores" },
                        { v: "veterinario", l: "Expertos" },
                    ].map(({ v, l }) => (
                        <button key={v} onClick={() => setFilter(v)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border ${filter === v ? "bg-rurapp-forest text-white border-rurapp-forest" : "bg-white text-rurapp-ink border-rurapp-edge hover:bg-rurapp-leaf"}`}
                            data-testid={`map-filter-${v}`}>{l}</button>
                    ))}
                </div>
            </div>
            <RurappMap users={filtered} height="600px" />
            <div className="mt-4 flex items-center gap-4 text-sm text-rurapp-inkSoft">
                <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {filtered.length} resultados</span>
            </div>
        </div>
    );
}
