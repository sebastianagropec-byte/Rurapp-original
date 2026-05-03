import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useCart } from "../lib/cart";

export default function PaymentSuccess() {
    const [params] = useSearchParams();
    const sessionId = params.get("session_id");
    const isMembership = params.get("membership") === "1";
    const [status, setStatus] = useState("polling"); // polling | paid | expired | error
    const [tx, setTx] = useState(null);
    const attempts = useRef(0);
    const { clear } = useCart();

    useEffect(() => {
        if (!sessionId) return;
        clear();
        let timer;
        const poll = async () => {
            try {
                const { data } = await api.get(`/payments/status/${sessionId}`);
                setTx(data);
                if (data.payment_status === "paid") { setStatus("paid"); return; }
                if (data.status === "expired") { setStatus("expired"); return; }
                attempts.current += 1;
                if (attempts.current >= 8) { setStatus("error"); return; }
                timer = setTimeout(poll, 2000);
            } catch (e) {
                setStatus("error");
            }
        };
        poll();
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    return (
        <div className="container-rurapp py-16 max-w-xl text-center" data-testid="payment-success">
            {status === "polling" && (
                <>
                    <Loader2 className="h-12 w-12 mx-auto text-rurapp-forest animate-spin" />
                    <h1 className="font-heading text-2xl font-bold mt-4">Confirmando tu pago…</h1>
                    <p className="text-rurapp-inkSoft mt-2">No cierres esta ventana</p>
                </>
            )}
            {status === "paid" && (
                <>
                    <CheckCircle2 className="h-16 w-16 mx-auto text-rurapp-forest" />
                    <h1 className="font-heading text-3xl font-bold mt-4">¡Pago exitoso!</h1>
                    <p className="text-rurapp-inkSoft mt-2">
                        {isMembership || tx?.type === "membership" ? "Tu membresía Rurapp ya está activa. Puedes empezar a publicar."
                            : tx?.type === "booking" ? "Tu cita está confirmada. El experto se pondrá en contacto."
                            : "Tu pedido fue confirmado. El productor lo preparará pronto."}
                    </p>
                    <div className="mt-6 flex justify-center gap-3 flex-wrap">
                        <Link to="/dashboard" className="btn-primary" data-testid="success-dashboard">Ir a mi cuenta</Link>
                        <Link to="/" className="btn-outline" data-testid="success-home">Inicio</Link>
                    </div>
                </>
            )}
            {(status === "expired" || status === "error") && (
                <>
                    <AlertTriangle className="h-12 w-12 mx-auto text-rurapp-earth2" />
                    <h1 className="font-heading text-2xl font-bold mt-4">No pudimos confirmar el pago</h1>
                    <p className="text-rurapp-inkSoft mt-2">Si el cargo se realizó, contáctanos. Sino, intenta nuevamente.</p>
                    <Link to="/" className="btn-primary inline-block mt-6" data-testid="success-home-error">Volver al inicio</Link>
                </>
            )}
        </div>
    );
}
