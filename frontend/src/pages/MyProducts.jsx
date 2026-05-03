import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plus, Edit3, Trash2 } from "lucide-react";

export function MyProducts() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);

    const load = () => api.get("/products/mine").then((r) => setProducts(r.data));
    useEffect(() => { load(); }, []);

    const onDelete = async (id) => {
        if (!window.confirm("¿Eliminar este producto?")) return;
        await api.delete(`/products/${id}`);
        load();
    };

    if (user?.role !== "productor") return <div className="container-rurapp py-20">Solo para productores</div>;

    return (
        <div className="container-rurapp py-8" data-testid="my-products-page">
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-heading text-3xl font-bold">Mis productos</h1>
                <Link to="/mis-productos/nuevo" className="btn-primary inline-flex items-center gap-2" data-testid="new-product-btn"><Plus className="h-4 w-4" /> Nuevo producto</Link>
            </div>
            {products.length === 0 ? (
                <div className="card-rurapp text-center py-12 text-rurapp-inkMuted">Aún no tienes productos</div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {products.map((p) => (
                        <div key={p.id} className="card-rurapp" data-testid={`mp-${p.id}`}>
                            {p.image_url && <img src={p.image_url} alt="" className="h-40 w-full object-cover rounded-xl mb-3" />}
                            <h3 className="font-heading font-semibold">{p.name}</h3>
                            <p className="text-sm text-rurapp-inkSoft line-clamp-2">{p.description}</p>
                            <div className="mt-3 flex items-center justify-between">
                                <div className="font-bold text-rurapp-forest">${p.price}/{p.unit}</div>
                                <span className="text-xs text-rurapp-inkMuted">Stock: {p.stock}</span>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <Link to={`/mis-productos/editar/${p.id}`} className="btn-outline flex-1 inline-flex items-center justify-center gap-1 text-sm" data-testid={`edit-${p.id}`}><Edit3 className="h-4 w-4" /> Editar</Link>
                                <button onClick={() => onDelete(p.id)} className="px-4 rounded-xl border border-rurapp-edge text-red-600 hover:bg-red-50" data-testid={`del-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ProductForm({ editing }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "", description: "", category: "frutas", price: 0, unit: "kg",
        stock: 0, image_url: "", origin_story: "", sustainable_practices: [],
    });
    const [practiceInput, setPracticeInput] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editing) {
            const id = window.location.pathname.split("/").pop();
            api.get(`/products/${id}`).then((r) => setForm({
                ...r.data,
                sustainable_practices: r.data.sustainable_practices || [],
            }));
        }
    }, [editing]);

    const onSubmit = async (e) => {
        e.preventDefault(); setErr(""); setLoading(true);
        try {
            if (editing) {
                const id = window.location.pathname.split("/").pop();
                await api.put(`/products/${id}`, form);
            } else {
                await api.post("/products", form);
            }
            navigate("/mis-productos");
        } catch (e) {
            setErr(e.response?.data?.detail || "No pudimos guardar el producto");
        } finally { setLoading(false); }
    };

    if (user?.role !== "productor") return <div className="container-rurapp py-20">Solo para productores</div>;

    return (
        <div className="container-rurapp py-8 max-w-3xl" data-testid="product-form">
            <h1 className="font-heading text-3xl font-bold mb-6">{editing ? "Editar producto" : "Nuevo producto"}</h1>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm" data-testid="pf-err">{err}</div>}
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Nombre" testId="pf-name"><input required className="input-rurapp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="Categoría" testId="pf-cat"><select className="input-rurapp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {["frutas", "verduras", "lácteos", "carnes", "animales", "derivados", "granos"].map((c) => <option key={c}>{c}</option>)}
                    </select></Field>
                    <Field label="Precio (COP)" testId="pf-price"><input type="number" required min={0} step="0.01" className="input-rurapp" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></Field>
                    <Field label="Unidad" testId="pf-unit"><input required className="input-rurapp" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, libra, unidad" /></Field>
                    <Field label="Stock" testId="pf-stock"><input type="number" required min={0} className="input-rurapp" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} /></Field>
                    <Field label="URL de imagen" testId="pf-img"><input className="input-rurapp" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></Field>
                </div>
                <Field label="Descripción" testId="pf-desc"><textarea required rows={3} className="input-rurapp" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <Field label="Historia / trazabilidad" testId="pf-story"><textarea rows={3} className="input-rurapp" value={form.origin_story} onChange={(e) => setForm({ ...form, origin_story: e.target.value })} placeholder="Cuenta de dónde viene tu producto, cómo lo cultivas…" /></Field>
                <div>
                    <span className="text-sm font-medium">Prácticas sostenibles</span>
                    <div className="flex gap-2 mt-1">
                        <input className="input-rurapp" value={practiceInput} onChange={(e) => setPracticeInput(e.target.value)} placeholder="Ej: Sin agroquímicos" data-testid="pf-practice-input" />
                        <button type="button" onClick={() => { if (practiceInput) { setForm({ ...form, sustainable_practices: [...form.sustainable_practices, practiceInput] }); setPracticeInput(""); }}} className="btn-outline" data-testid="pf-practice-add">Agregar</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {form.sustainable_practices.map((s, i) => (
                            <span key={i} className="chip cursor-pointer" onClick={() => setForm({ ...form, sustainable_practices: form.sustainable_practices.filter((_, j) => j !== i) })}>{s} ×</span>
                        ))}
                    </div>
                </div>
                <button disabled={loading} className="btn-primary w-full" data-testid="pf-submit">{loading ? "Guardando…" : "Guardar"}</button>
            </form>
        </div>
    );
}

function Field({ label, children, testId }) {
    return <label className="block" data-testid={testId}><span className="text-sm font-medium">{label}</span><div className="mt-1">{children}</div></label>;
}
