import { CreditCard } from "lucide-react";

const PROVIDERS = [
    { id: "stripe", label: "Tarjeta internacional (Stripe)", desc: "USD · Visa, MasterCard", flag: "🌎" },
    { id: "wompi", label: "Wompi (Colombia)", desc: "COP · PSE, Bancolombia, tarjetas", flag: "🇨🇴" },
    { id: "mercadopago", label: "MercadoPago", desc: "COP · Tarjetas, Efecty, etc.", flag: "🇦🇷" },
];

export default function PaymentProviderSelector({ value, onChange, dataTestPrefix = "pp" }) {
    return (
        <div className="space-y-2">
            <span className="text-sm font-medium flex items-center gap-1"><CreditCard className="h-4 w-4" /> Método de pago</span>
            <div className="grid gap-2">
                {PROVIDERS.map((p) => (
                    <button type="button" key={p.id} onClick={() => onChange(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${value === p.id ? "border-rurapp-forest bg-rurapp-leaf/40" : "border-rurapp-edge bg-white hover:bg-rurapp-leaf/20"}`}
                        data-testid={`${dataTestPrefix}-${p.id}`}>
                        <span className="text-2xl">{p.flag}</span>
                        <div className="flex-1">
                            <div className="font-medium text-rurapp-ink">{p.label}</div>
                            <div className="text-xs text-rurapp-inkMuted">{p.desc}</div>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 ${value === p.id ? "border-rurapp-forest bg-rurapp-forest" : "border-rurapp-edge"}`}>
                            {value === p.id && <div className="h-full w-full flex items-center justify-center text-white text-xs">✓</div>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
