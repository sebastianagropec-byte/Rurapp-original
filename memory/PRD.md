# Rurapp · Product Requirements Document

## Original problem statement
Plataforma web AgTech para Colombia que conecta el campo y la ciudad: productores, veterinarios/expertos y clientes. Marketplace de productos agropecuarios + servicios profesionales del campo. Membresía mensual para productores/expertos como modelo de monetización. Pagos directos cliente↔productor / cliente↔veterinario. UX simple para usuarios no nativos digitales.

## User personas
- **Productor (Campesino)**: Vende productos del campo, acepta pedidos, cuenta su historia y prácticas sostenibles. Necesita membresía activa para publicar.
- **Veterinario / Experto**: Ofrece servicios (consultas virtuales, visitas a finca, asesoría técnica, capacitación). Necesita membresía activa para publicar. Genera contenido educativo.
- **Cliente urbano**: Compra productos frescos, agenda servicios profesionales, consulta el origen y trazabilidad. Sin costo de membresía.
- **Rurapp (operador de plataforma)**: Cobra membresías mensuales a productores/expertos para sostener la plataforma.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT auth + Stripe (emergentintegrations) + Claude Sonnet 4.5 (emergentintegrations).
- **Frontend**: React 19 + React Router 7 + Tailwind CSS + lucide-react + sonner (toasts).
- **DB collections**: `users`, `products`, `services`, `orders`, `bookings`, `reviews`, `articles`, `ai_messages`, `payment_transactions`.
- **Auth**: JWT bearer token, 30 days expiry.
- **Idempotent payment processing** via webhook + polling fallback.

## Implemented (Feb 2026)
- ✅ Registro/login JWT con 3 roles diferenciados (productor, veterinario, cliente)
- ✅ Marketplace de productos con filtros por categoría, ubicación y búsqueda
- ✅ Marketplace de servicios profesionales con categorías y filtros
- ✅ Detalle de producto con trazabilidad, prácticas sostenibles, reseñas y carrito
- ✅ Detalle de servicio con agendamiento (datetime-local) y pago
- ✅ Carrito de compras persistente (localStorage)
- ✅ Pagos Stripe con polling de status + webhook handler
- ✅ Sistema de membresía con planes Básico ($9.99/mes) y Pro ($24.99/mes)
- ✅ Bloqueo de publicación (HTTP 402) cuando productor/experto no tiene membresía
- ✅ Dashboard rol-aware con métricas y CTAs específicos
- ✅ Mis productos / Mis servicios (CRUD completo)
- ✅ Mis pedidos / Mis citas (cliente) y Pedidos/citas recibidos (productor/experto)
- ✅ Sistema de reseñas con cálculo de rating promedio
- ✅ Feed de contenido educativo (artículos por categoría con likes)
- ✅ Asistente AI "Rura" con Claude Sonnet 4.5 (chat con persistencia)
- ✅ Perfil público de usuarios con sus productos/servicios
- ✅ Edición de perfil propio
- ✅ Diseño tierra (verdes #2D5A27 y terracota #D4A373) mobile-first
- ✅ Bottom nav móvil + top bar desktop
- ✅ Botones grandes (48px+) y alto contraste para uso al aire libre
- ✅ Tipografías: Outfit (títulos) + Work Sans (cuerpo)
- ✅ Datos demo (4 usuarios, 6 productos, 4 servicios, 3 artículos)

## Phase 2 (Feb 2026)
- ✅ **Mapa interactivo Leaflet + OpenStreetMap** con marcadores diferenciados (productor verde / experto terracota), página `/mapa` con filtros + mini-mapa en perfiles públicos
- ✅ **Geolocalización**: campos `lat`/`lng` en User, persistidos en registro y editables en perfil
- ✅ **Chat en tiempo real con WebSocket** (`/api/ws/chat?token=<jwt>`) + REST de conversaciones y mensajes; botones "Enviar mensaje" en perfiles, ProductDetail y ServiceDetail
- ✅ **Notificación de chat por email** cuando el destinatario está offline (vía SendGrid, MOCKED)
- ✅ **Pagos Wompi (Colombia)** y **MercadoPago** como alternativas a Stripe; selector visual de método de pago en checkout/booking/membresía
- ✅ Conversión USD→COP automática para membresías cuando se paga vía Wompi/MP (~4000 COP/USD)
- ✅ Webhooks `/api/webhook/wompi` y `/api/webhook/mercadopago` con procesamiento idempotente
- ✅ **Verificación de veterinarios con IA + admin combinada**: Claude Sonnet 4.5 pre-analiza coherencia, admin confirma manualmente. Estados: `none → pending → ai_approved → approved/rejected`. Página `/verificacion`
- ✅ **Panel de administración** (`/admin`): listado filtrable de verificaciones, aprobar/rechazar con notas, vista del análisis IA. Acceso por flag `is_admin` o `ADMIN_EMAILS` env
- ✅ **Notificaciones email transaccionales SendGrid**: confirmación de pedido, cita, recibo de membresía, mensaje de chat offline (todos MOCKED hasta tener API key)
- ✅ Usuario admin demo: `admin@rurapp.co / rurapp123`
- ✅ Test coverage: 92/93 backend tests passing (98.9%) en iteration_2

## Test credentials
- `campesino@rurapp.co` / `rurapp123` — Productor (membresía activa, verificado)
- `vet@rurapp.co` / `rurapp123` — Veterinario (membresía activa, verificado)
- `cliente@rurapp.co` / `rurapp123` — Cliente
- `admin@rurapp.co` / `rurapp123` — Administrador (acceso a `/admin`)

## Backlog (P1 - próximas iteraciones)
- Google OAuth login (actualmente solo email/password)
- Chat interno en tiempo real entre cliente y productor/experto (WebSocket)
- Mapa interactivo con geolocalización GPS real
- Wompi/PayU/MercadoPago como pasarela de pago para Colombia (actualmente Stripe)
- Sistema de notificaciones (push/email con Resend o SendGrid)
- Panel admin para verificación manual de veterinarios
- Reseñas restringidas a usuarios que efectivamente compraron/contrataron
- Dedupe de likes en artículos por usuario
- Rate limiting en /api/auth/login y /api/ai/chat

## Backlog (P2)
- App móvil nativa (React Native)
- Modo offline / PWA
- Multi-idioma (inglés)
- Dashboard analítico para productores
- Programa de afiliados
- Sello "Verificado" automatizado con documentos
- Precios dinámicos por temporada

## Known external limitations
- El asistente AI puede fallar tras múltiples llamadas si se excede el presupuesto del EMERGENT_LLM_KEY (manejado con error 503 amigable).
- El polling de status de Stripe usa fallback al estado en BD si la API de Stripe falla, gracias al webhook `/api/webhook/stripe`.
