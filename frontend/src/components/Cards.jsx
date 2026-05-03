import { Link } from "react-router-dom";
import { Star, MapPin, Leaf } from "lucide-react";

export function ProductCard({ product }) {
    return (
        <Link to={`/producto/${product.id}`} className="card-rurapp group p-0 overflow-hidden hover:-translate-y-1 transition-all" data-testid={`product-card-${product.id}`}>
            <div className="relative h-44 bg-rurapp-sand overflow-hidden">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-rurapp-inkMuted">
                        <Leaf className="h-10 w-10" />
                    </div>
                )}
                {(product.sustainable_practices || []).length > 0 && (
                    <span className="absolute top-3 left-3 chip"><Leaf className="h-3 w-3 mr-1" /> Sostenible</span>
                )}
            </div>
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-semibold text-rurapp-ink leading-tight">{product.name}</h3>
                    <div className="text-rurapp-forest font-bold whitespace-nowrap">${product.price.toLocaleString("es-CO")}<span className="text-xs text-rurapp-inkMuted font-normal">/{product.unit}</span></div>
                </div>
                <p className="text-sm text-rurapp-inkSoft line-clamp-2 mt-1">{product.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-rurapp-inkMuted">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {product.producer_location || "Colombia"}</span>
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-rurapp-earth text-rurapp-earth" /> {product.rating_avg?.toFixed(1) || "Nuevo"}</span>
                </div>
            </div>
        </Link>
    );
}

export function ServiceCard({ service }) {
    return (
        <Link to={`/servicio/${service.id}`} className="card-rurapp group p-0 overflow-hidden hover:-translate-y-1 transition-all" data-testid={`service-card-${service.id}`}>
            <div className="relative h-40 bg-rurapp-leaf overflow-hidden">
                {service.image_url ? (
                    <img src={service.image_url} alt={service.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-rurapp-forest font-heading text-2xl">
                        Servicio profesional
                    </div>
                )}
                <span className="absolute top-3 left-3 chip-earth">{service.category?.replace("_", " ")}</span>
            </div>
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-semibold text-rurapp-ink leading-tight">{service.title}</h3>
                    <div className="text-rurapp-forest font-bold whitespace-nowrap">${service.price.toLocaleString("es-CO")}</div>
                </div>
                <p className="text-sm text-rurapp-inkSoft line-clamp-2 mt-1">{service.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-rurapp-inkMuted">
                    <span>{service.expert_name}{service.expert_specialty ? ` · ${service.expert_specialty}` : ""}</span>
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-rurapp-earth text-rurapp-earth" /> {service.rating_avg?.toFixed(1) || "Nuevo"}</span>
                </div>
            </div>
        </Link>
    );
}
