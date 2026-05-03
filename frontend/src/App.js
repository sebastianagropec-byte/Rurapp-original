import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import { Toaster } from "sonner";

import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Marketplace from "./pages/Marketplace";
import Servicios from "./pages/Servicios";
import ProductDetail from "./pages/ProductDetail";
import ServiceDetail from "./pages/ServiceDetail";
import Cart from "./pages/Cart";
import PaymentSuccess from "./pages/PaymentSuccess";
import AIAssistant from "./pages/AIAssistant";
import Dashboard from "./pages/Dashboard";
import { MyProducts, ProductForm } from "./pages/MyProducts";
import { MyServices, ServiceForm } from "./pages/MyServices";
import { MyOrders, MyBookings, ReceivedOrders, ReceivedBookings } from "./pages/Orders";
import Membership from "./pages/Membership";
import Profile from "./pages/Profile";
import { Articles, ArticleDetail, NewArticle } from "./pages/Articles";
import PublicProfile from "./pages/PublicProfile";

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="py-24 text-center text-rurapp-inkMuted">Cargando…</div>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <CartProvider>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Landing />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/marketplace" element={<Marketplace />} />
                                <Route path="/servicios" element={<Servicios />} />
                                <Route path="/producto/:id" element={<ProductDetail />} />
                                <Route path="/servicio/:id" element={<ServiceDetail />} />
                                <Route path="/cart" element={<Cart />} />
                                <Route path="/payment/success" element={<PaymentSuccess />} />
                                <Route path="/asistente" element={<AIAssistant />} />
                                <Route path="/contenido" element={<Articles />} />
                                <Route path="/contenido/nuevo" element={<Protected><NewArticle /></Protected>} />
                                <Route path="/contenido/:id" element={<ArticleDetail />} />
                                <Route path="/perfil/:id" element={<PublicProfile />} />

                                {/* Protected */}
                                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                                <Route path="/perfil" element={<Protected><Profile /></Protected>} />
                                <Route path="/membresia" element={<Protected><Membership /></Protected>} />
                                <Route path="/mis-productos" element={<Protected><MyProducts /></Protected>} />
                                <Route path="/mis-productos/nuevo" element={<Protected><ProductForm /></Protected>} />
                                <Route path="/mis-productos/editar/:id" element={<Protected><ProductForm editing /></Protected>} />
                                <Route path="/mis-servicios" element={<Protected><MyServices /></Protected>} />
                                <Route path="/mis-servicios/nuevo" element={<Protected><ServiceForm /></Protected>} />
                                <Route path="/mis-servicios/editar/:id" element={<Protected><ServiceForm editing /></Protected>} />
                                <Route path="/mis-pedidos" element={<Protected><MyOrders /></Protected>} />
                                <Route path="/mis-citas" element={<Protected><MyBookings /></Protected>} />
                                <Route path="/pedidos-recibidos" element={<Protected><ReceivedOrders /></Protected>} />
                                <Route path="/citas-recibidas" element={<Protected><ReceivedBookings /></Protected>} />
                            </Routes>
                        </Layout>
                        <Toaster position="top-right" richColors />
                    </CartProvider>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
