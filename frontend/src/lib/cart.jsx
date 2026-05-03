import { createContext, useContext, useEffect, useState } from "react";

const CartCtx = createContext(null);
const KEY = "rurapp_cart";

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem(KEY, JSON.stringify(items));
    }, [items]);

    const addItem = (product, quantity = 1) => {
        setItems((prev) => {
            const idx = prev.findIndex((p) => p.product_id === product.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
                return next;
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                price: product.price,
                unit: product.unit,
                image_url: product.image_url,
                producer_name: product.producer_name,
                quantity,
            }];
        });
    };

    const updateQty = (product_id, quantity) => {
        setItems((prev) => prev.map((p) =>
            p.product_id === product_id ? { ...p, quantity: Math.max(1, quantity) } : p
        ));
    };

    const removeItem = (product_id) => {
        setItems((prev) => prev.filter((p) => p.product_id !== product_id));
    };

    const clear = () => setItems([]);

    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const count = items.reduce((s, it) => s + it.quantity, 0);

    return (
        <CartCtx.Provider value={{ items, addItem, updateQty, removeItem, clear, total, count }}>
            {children}
        </CartCtx.Provider>
    );
}

export const useCart = () => useContext(CartCtx);
