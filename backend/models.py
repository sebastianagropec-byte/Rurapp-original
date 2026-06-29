"""Pydantic models for Rurapp."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


# ===== USERS =====
UserRole = Literal["productor", "veterinario", "cliente"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    location: Optional[str] = None  # ciudad/región
    bio: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    sustainable_practices: Optional[List[str]] = []
    specialty: Optional[str] = None  # for vet/expert
    verified: bool = False
    verification_status: Optional[str] = "none"  # none, pending, approved, rejected
    membership_active: bool = False
    membership_expires_at: Optional[str] = None
    membership_plan: Optional[str] = None  # "basico" | "pro"
    on_trial: bool = False
    trial_used: bool = False
    trial_ends_at: Optional[str] = None
    rating_avg: float = 0.0
    rating_count: int = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_admin: bool = False
    created_at: str = Field(default_factory=now_iso)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    sustainable_practices: Optional[List[str]] = None
    specialty: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ===== PRODUCTS =====
class ProductCreate(BaseModel):
    name: str
    description: str
    category: str  # frutas, verduras, animales, lácteos, derivados, etc.
    price: float
    unit: str  # kg, libra, unidad, etc.
    stock: int = 0
    image_url: Optional[str] = None
    sustainable_practices: Optional[List[str]] = []
    origin_story: Optional[str] = None  # trazabilidad


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    sustainable_practices: Optional[List[str]] = None
    origin_story: Optional[str] = None
    active: Optional[bool] = None


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    producer_id: str
    producer_name: str
    producer_location: Optional[str] = None
    name: str
    description: str
    category: str
    price: float
    unit: str
    stock: int = 0
    image_url: Optional[str] = None
    sustainable_practices: List[str] = []
    origin_story: Optional[str] = None
    active: bool = True
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: str = Field(default_factory=now_iso)


# ===== SERVICES (Vet/Expert offerings) =====
class ServiceCreate(BaseModel):
    title: str
    description: str
    category: str  # consulta_virtual, asesoria_tecnica, visita_finca
    price: float
    duration_minutes: int = 30
    image_url: Optional[str] = None


class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class Service(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    expert_id: str
    expert_name: str
    expert_specialty: Optional[str] = None
    expert_location: Optional[str] = None
    title: str
    description: str
    category: str
    price: float
    duration_minutes: int = 30
    image_url: Optional[str] = None
    active: bool = True
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: str = Field(default_factory=now_iso)


# ===== ORDERS =====
class CartItem(BaseModel):
    product_id: str
    quantity: int


class OrderCreateRequest(BaseModel):
    items: List[CartItem]
    delivery_address: str
    notes: Optional[str] = None
    origin_url: str  # window.location.origin from frontend
    payment_provider: Optional[Literal["stripe", "wompi", "mercadopago", "cod"]] = "stripe"


class OrderItem(BaseModel):
    product_id: str
    product_name: str
    producer_id: str
    quantity: int
    unit_price: float
    subtotal: float


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    customer_id: str
    customer_name: str
    items: List[OrderItem]
    total: float
    delivery_address: str
    notes: Optional[str] = None
    status: str = "pending_payment"  # pending_payment, paid, preparing, shipped, delivered, cancelled
    payment_session_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ===== BOOKINGS (vet appointments) =====
class BookingCreateRequest(BaseModel):
    service_id: str
    scheduled_at: str  # ISO datetime
    notes: Optional[str] = None
    origin_url: str
    payment_provider: Optional[Literal["stripe", "wompi", "mercadopago", "cod"]] = "stripe"


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    customer_id: str
    customer_name: str
    expert_id: str
    expert_name: str
    service_id: str
    service_title: str
    price: float
    scheduled_at: str
    notes: Optional[str] = None
    status: str = "pending_payment"  # pending_payment, confirmed, completed, cancelled
    payment_session_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ===== REVIEWS =====
class ReviewCreate(BaseModel):
    target_type: Literal["product", "service", "user"]
    target_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    author_id: str
    author_name: str
    target_type: str
    target_id: str
    rating: int
    comment: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ===== ARTICLES (Educational feed) =====
class ArticleCreate(BaseModel):
    title: str
    content: str
    category: str  # salud_animal, cultivos, sostenibilidad, productividad
    image_url: Optional[str] = None
    tags: Optional[List[str]] = []


class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    author_id: str
    author_name: str
    author_role: str
    title: str
    content: str
    category: str
    image_url: Optional[str] = None
    tags: List[str] = []
    likes: int = 0
    created_at: str = Field(default_factory=now_iso)


# ===== AI CHAT =====
class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class AIChatResponse(BaseModel):
    session_id: str
    reply: str


# ===== PAYMENTS =====
class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: float
    currency: str
    metadata: dict


class MembershipCheckoutRequest(BaseModel):
    plan_id: str  # "basico" or "pro"
    origin_url: str
    payment_provider: Optional[Literal["stripe", "wompi", "mercadopago"]] = "stripe"


class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    session_id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    type: str  # "order", "booking", "membership"
    reference_id: Optional[str] = None  # order_id / booking_id / plan_id
    amount: float
    currency: str = "usd"
    provider: str = "stripe"  # stripe, wompi, mercadopago
    status: str = "initiated"  # initiated, pending, paid, expired, failed
    payment_status: str = "unpaid"
    metadata: dict = {}
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ===== CHAT =====
class ConversationCreate(BaseModel):
    other_user_id: str


class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    participants: List[str]  # [user_id_a, user_id_b]
    participant_names: dict = {}  # {user_id: full_name}
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    unread_for: dict = {}  # {user_id: count}
    created_at: str = Field(default_factory=now_iso)


class MessageCreate(BaseModel):
    conversation_id: str
    content: str


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    conversation_id: str
    sender_id: str
    sender_name: str
    content: str
    read_by: List[str] = []
    created_at: str = Field(default_factory=now_iso)


# ===== VERIFICATION =====
class VerificationSubmit(BaseModel):
    document_type: str  # "cedula_profesional", "tarjeta_profesional", "diploma"
    document_url: Optional[str] = None  # URL or data: URI (optional - can submit text-only first)
    professional_name: str
    professional_id: str  # Numero de matricula/cedula profesional
    institution: Optional[str] = None
    notes: Optional[str] = None


class Verification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    user_id: str
    user_email: str
    user_name: str
    document_type: str
    document_url: Optional[str] = None
    professional_name: str
    professional_id: str
    institution: Optional[str] = None
    notes: Optional[str] = None
    ai_analysis: Optional[str] = None
    ai_recommendation: Optional[str] = None  # approve, review, reject
    status: str = "pending"  # pending, ai_approved, approved, rejected
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class AdminReviewRequest(BaseModel):
    decision: Literal["approve", "reject"]
    admin_notes: Optional[str] = None
