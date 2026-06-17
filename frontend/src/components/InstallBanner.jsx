import { useEffect, useState } from "react";
import { Download, X, WifiOff } from "lucide-react";
import { canInstall, onInstallChange, promptInstall, isStandalone, isOnline } from "../lib/pwa";

const DISMISS_KEY = "rurapp_install_dismissed";

export function InstallBanner() {
    const [available, setAvailable] = useState(canInstall());
    const [dismissed, setDismissed] = useState(
        typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
    );

    useEffect(() => onInstallChange(setAvailable), []);

    if (!available || dismissed || isStandalone()) return null;

    const onInstall = async () => {
        await promptInstall();
    };
    const onDismiss = () => {
        localStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
    };

    return (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-white rounded-2xl border border-rurapp-edge shadow-lg p-4 flex items-center gap-3 animate-fade-up" data-testid="install-banner">
            <div className="h-10 w-10 rounded-xl bg-rurapp-forest text-white flex items-center justify-center flex-shrink-0">
                <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-sm">Instala Rurapp</div>
                <div className="text-xs text-rurapp-inkSoft">Úsala como app y trabaja sin conexión</div>
            </div>
            <button onClick={onInstall} className="text-sm font-semibold text-white bg-rurapp-forest px-3 py-1.5 rounded-lg" data-testid="install-btn">Instalar</button>
            <button onClick={onDismiss} className="text-rurapp-inkMuted p-1" data-testid="install-dismiss" aria-label="Cerrar">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function OfflineBanner() {
    const [online, setOnline] = useState(isOnline());

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
            window.removeEventListener("online", up);
            window.removeEventListener("offline", down);
        };
    }, []);

    if (online) return null;
    return (
        <div className="bg-rurapp-earth text-white text-sm text-center py-2 flex items-center justify-center gap-2" data-testid="offline-banner">
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión. Mostrando contenido guardado.</span>
        </div>
    );
}
