import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BookOpen, Heart, Plus, ArrowLeft } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

const CATEGORIES = ["Todas", "salud_animal", "cultivos", "sostenibilidad", "productividad"];

export function Articles() {
    const { user } = useAuth();
    const [articles, setArticles] = useState([]);
    const [category, setCategory] = useState("Todas");

    useEffect(() => {
        const params = {};
        if (category !== "Todas") params.category = category;
        api.get("/articles", { params }).then((r) => setArticles(r.data));
    }, [category]);

    const canPost = user?.role === "veterinario" || user?.role === "productor";

    return (
        <div className="container-rurapp py-8" data-testid="articles-page">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-rurapp-forest font-bold">Conocimiento</p>
                    <h1 className="font-heading text-3xl md:text-4xl font-bold">Aprende con la comunidad</h1>
                    <p className="text-rurapp-inkSoft mt-1">Artículos y consejos compartidos por expertos del campo</p>
                </div>
                {canPost && <Link to="/contenido/nuevo" className="btn-primary inline-flex items-center gap-2" data-testid="new-article-btn"><Plus className="h-4 w-4" /> Publicar</Link>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                {CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCategory(c)}
                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${category === c ? "bg-rurapp-forest text-white border-rurapp-forest" : "bg-white text-rurapp-ink border-rurapp-edge hover:bg-rurapp-leaf"}`}
                        data-testid={`acat-${c}`}>{c.replace("_", " ")}</button>
                ))}
            </div>
            {articles.length === 0 ? (
                <div className="card-rurapp text-center py-16">
                    <BookOpen className="h-12 w-12 mx-auto text-rurapp-forest mb-3" />
                    <h3 className="font-heading text-xl font-semibold">Aún no hay artículos</h3>
                    <p className="text-rurapp-inkSoft mt-1">Sé el primero en compartir conocimiento.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {articles.map((a) => (
                        <Link to={`/contenido/${a.id}`} key={a.id} className="card-rurapp p-0 overflow-hidden hover:-translate-y-1 transition-all" data-testid={`article-${a.id}`}>
                            {a.image_url && <img src={a.image_url} alt={a.title} className="h-40 w-full object-cover" />}
                            <div className="p-4">
                                <span className="chip">{a.category?.replace("_", " ")}</span>
                                <h3 className="font-heading font-semibold mt-2 line-clamp-2">{a.title}</h3>
                                <p className="text-sm text-rurapp-inkSoft mt-1 line-clamp-2">{a.content}</p>
                                <div className="mt-3 flex items-center justify-between text-xs text-rurapp-inkMuted">
                                    <span>Por {a.author_name}</span>
                                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {a.likes}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ArticleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);

    useEffect(() => { api.get(`/articles/${id}`).then((r) => setArticle(r.data)); }, [id]);

    const onLike = async () => {
        await api.post(`/articles/${id}/like`);
        const { data } = await api.get(`/articles/${id}`);
        setArticle(data);
    };

    if (!article) return <div className="container-rurapp py-20 text-center">Cargando…</div>;

    return (
        <div className="container-rurapp py-6 max-w-3xl" data-testid="article-detail">
            <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-rurapp-forest"><ArrowLeft className="h-4 w-4" /> Volver</button>
            {article.image_url && <img src={article.image_url} alt={article.title} className="w-full h-72 object-cover rounded-2xl mb-6" />}
            <span className="chip">{article.category?.replace("_", " ")}</span>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mt-3">{article.title}</h1>
            <div className="text-rurapp-inkSoft mt-2 text-sm">Por {article.author_name} · {new Date(article.created_at).toLocaleDateString("es-CO")}</div>
            <div className="prose prose-stone mt-6 whitespace-pre-wrap text-rurapp-inkSoft text-lg leading-relaxed">{article.content}</div>
            <button onClick={onLike} className="mt-6 btn-outline inline-flex items-center gap-2" data-testid="like-btn">
                <Heart className="h-4 w-4" /> Me gusta ({article.likes})
            </button>
        </div>
    );
}

export function NewArticle() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: "", content: "", category: "salud_animal", image_url: "", tags: [] });
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            await api.post("/articles", form);
            navigate("/contenido");
        } finally { setLoading(false); }
    };

    if (!user || (user.role !== "veterinario" && user.role !== "productor")) return <div className="container-rurapp py-20">No autorizado</div>;

    return (
        <div className="container-rurapp py-8 max-w-3xl" data-testid="new-article-page">
            <h1 className="font-heading text-3xl font-bold mb-6">Compartir conocimiento</h1>
            <form onSubmit={onSubmit} className="card-rurapp space-y-4">
                <label className="block"><span className="text-sm font-medium">Título</span>
                    <input required className="input-rurapp mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="art-title" /></label>
                <label className="block"><span className="text-sm font-medium">Categoría</span>
                    <select className="input-rurapp mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="art-category">
                        {CATEGORIES.filter((c) => c !== "Todas").map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                    </select></label>
                <label className="block"><span className="text-sm font-medium">URL de imagen</span>
                    <input className="input-rurapp mt-1" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} data-testid="art-image" /></label>
                <label className="block"><span className="text-sm font-medium">Contenido</span>
                    <textarea required rows={10} className="input-rurapp mt-1" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} data-testid="art-content" /></label>
                <button disabled={loading} className="btn-primary w-full" data-testid="art-submit">{loading ? "Publicando…" : "Publicar artículo"}</button>
            </form>
        </div>
    );
}
