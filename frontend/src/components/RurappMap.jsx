import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { Sprout, Stethoscope } from "lucide-react";

// Fix default marker icons (leaflet bundling issue with webpack)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const producerIcon = L.divIcon({
    className: "rurapp-marker",
    html: `<div style="background:#2D5A27;border:3px solid white;border-radius:50% 50% 50% 0;width:36px;height:36px;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:18px;">🌾</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

const expertIcon = L.divIcon({
    className: "rurapp-marker",
    html: `<div style="background:#D4A373;border:3px solid white;border-radius:50% 50% 50% 0;width:36px;height:36px;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:white;font-weight:bold;font-size:18px;">⚕</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
});

export function RurappMap({ users = [], height = "500px", center = [4.5709, -74.2973], zoom = 6 }) {
    const valid = users.filter((u) => u.lat && u.lng);
    return (
        <div className="rounded-2xl overflow-hidden border border-rurapp-edge" style={{ height }} data-testid="rurapp-map">
            <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {valid.map((u) => (
                    <Marker
                        key={u.id}
                        position={[u.lat, u.lng]}
                        icon={u.role === "productor" ? producerIcon : expertIcon}
                    >
                        <Popup>
                            <div style={{ minWidth: 180 }}>
                                <div className="flex items-center gap-2 mb-1">
                                    {u.role === "productor"
                                        ? <Sprout className="h-4 w-4" style={{ color: "#2D5A27" }} />
                                        : <Stethoscope className="h-4 w-4" style={{ color: "#D4A373" }} />}
                                    <strong>{u.full_name}</strong>
                                </div>
                                <div style={{ fontSize: 12, color: "#7A7A7A", marginBottom: 4 }}>
                                    {u.role === "productor" ? "Productor" : "Experto"} · {u.location}
                                </div>
                                {u.specialty && <div style={{ fontSize: 12, marginBottom: 6 }}>{u.specialty}</div>}
                                <Link to={`/perfil/${u.id}`} className="text-rurapp-forest font-medium" style={{ fontSize: 13 }}>
                                    Ver perfil →
                                </Link>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

export function MiniMap({ lat, lng, height = "200px", label = "Ubicación aproximada" }) {
    if (!lat || !lng) return null;
    return (
        <div className="rounded-2xl overflow-hidden border border-rurapp-edge" style={{ height }} data-testid="mini-map">
            <MapContainer center={[lat, lng]} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                />
                <Marker position={[lat, lng]}>
                    <Popup>{label}</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
