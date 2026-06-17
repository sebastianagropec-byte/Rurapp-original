/* PWA helpers: register service worker + capture install prompt */

let deferredPrompt = null;
const listeners = new Set();

export function registerServiceWorker() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip in CRA dev unless the file exists (it does because we placed it in public/)
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/service-worker.js")
            .then((reg) => {
                // Auto-activate updates without forcing reload
                if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
                reg.addEventListener("updatefound", () => {
                    const sw = reg.installing;
                    if (!sw) return;
                    sw.addEventListener("statechange", () => {
                        if (sw.state === "installed" && navigator.serviceWorker.controller) {
                            sw.postMessage({ type: "SKIP_WAITING" });
                        }
                    });
                });
            })
            .catch(() => {});
    });

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        listeners.forEach((cb) => cb(true));
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        listeners.forEach((cb) => cb(false));
    });
}

export function canInstall() {
    return !!deferredPrompt;
}

export function onInstallChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export async function promptInstall() {
    if (!deferredPrompt) return { outcome: "unavailable" };
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((cb) => cb(false));
    return choice;
}

export function isStandalone() {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.navigator.standalone === true
    );
}

export function isOnline() {
    return typeof navigator === "undefined" ? true : navigator.onLine;
}
