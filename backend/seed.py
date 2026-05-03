"""Seed demo data for Rurapp."""
import asyncio
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import sys

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from auth import hash_password
from models import gen_id, now_iso


async def seed():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Wipe demo data (keep collections clean for predictable demo)
    await db.users.delete_many({"email": {"$in": [
        "campesino@rurapp.co", "vet@rurapp.co", "cliente@rurapp.co"
    ]}})

    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    producer_id = gen_id()
    producer = {
        "id": producer_id,
        "email": "campesino@rurapp.co",
        "password_hash": hash_password("rurapp123"),
        "full_name": "María Pérez",
        "role": "productor",
        "phone": "3001234567",
        "location": "Boyacá",
        "bio": "Tercera generación cultivando papa criolla y hortalizas en Tunja. Sin agroquímicos.",
        "avatar_url": None,
        "sustainable_practices": ["Sin agroquímicos", "Riego por goteo", "Compostaje propio"],
        "specialty": None,
        "verified": True,
        "membership_active": True,
        "membership_expires_at": expires,
        "rating_avg": 4.8, "rating_count": 12,
        "created_at": now_iso(),
    }
    vet_id = gen_id()
    vet = {
        "id": vet_id,
        "email": "vet@rurapp.co",
        "password_hash": hash_password("rurapp123"),
        "full_name": "Dr. Carlos Ramírez",
        "role": "veterinario",
        "phone": "3019876543",
        "location": "Cundinamarca",
        "bio": "Médico veterinario zootecnista con 15 años de experiencia en bovinos y aves de corral.",
        "avatar_url": None,
        "sustainable_practices": [],
        "specialty": "Bovinos y aves",
        "verified": True,
        "membership_active": True,
        "membership_expires_at": expires,
        "rating_avg": 4.9, "rating_count": 22,
        "created_at": now_iso(),
    }
    cliente_id = gen_id()
    cliente = {
        "id": cliente_id,
        "email": "cliente@rurapp.co",
        "password_hash": hash_password("rurapp123"),
        "full_name": "Laura González",
        "role": "cliente",
        "phone": "3105557788",
        "location": "Bogotá",
        "bio": "Mamá interesada en alimentación consciente y apoyo al campo.",
        "avatar_url": None,
        "sustainable_practices": [],
        "specialty": None,
        "verified": False,
        "membership_active": True,
        "membership_expires_at": None,
        "rating_avg": 0.0, "rating_count": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_many([producer, vet, cliente])

    # Products (delete & insert demo products)
    await db.products.delete_many({"producer_id": {"$in": [producer_id]}})
    products = [
        {"name": "Papa criolla orgánica", "category": "verduras", "price": 4500,
         "unit": "libra", "stock": 50, "description": "Papa criolla cosechada esta semana, sin químicos.",
         "image_url": "https://images.unsplash.com/photo-1508313880080-c4bef0730395?w=800",
         "sustainable_practices": ["Sin agroquímicos", "Cosecha manual"],
         "origin_story": "Cultivada en finca familiar de 3 hectáreas en Tunja, Boyacá. La semilla viene de mi abuela."},
        {"name": "Tomate cherry", "category": "verduras", "price": 6000, "unit": "libra", "stock": 30,
         "description": "Tomate cherry rojo, dulce, recogido al amanecer.",
         "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800",
         "sustainable_practices": ["Riego por goteo"],
         "origin_story": "Invernadero de 200m² con riego por goteo programado."},
        {"name": "Queso campesino fresco", "category": "lácteos", "price": 12000, "unit": "kg", "stock": 15,
         "description": "Queso fresco hecho a mano con leche del día.",
         "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800",
         "sustainable_practices": ["Producción artesanal"],
         "origin_story": "Receta tradicional de mi familia desde 1950."},
        {"name": "Huevos criollos", "category": "derivados", "price": 800, "unit": "unidad", "stock": 200,
         "description": "Huevos de gallinas criadas libres en patio, alimentación natural.",
         "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800",
         "sustainable_practices": ["Gallinas felices", "Alimentación natural"],
         "origin_story": "Tenemos 80 gallinas que viven libres en el patio."},
        {"name": "Mango Tommy", "category": "frutas", "price": 3500, "unit": "kg", "stock": 100,
         "description": "Mango Tommy maduro, dulce y jugoso.",
         "image_url": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=800",
         "sustainable_practices": ["Sin agroquímicos"],
         "origin_story": "Cultivado en zona cálida sin pesticidas."},
        {"name": "Café especial", "category": "granos", "price": 35000, "unit": "kg", "stock": 25,
         "description": "Café tostado artesanalmente, notas de chocolate y caramelo.",
         "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800",
         "sustainable_practices": ["Comercio justo", "Cultivo bajo sombra"],
         "origin_story": "Finca familiar a 1800 msnm. Tueste medio."},
    ]
    for p in products:
        await db.products.insert_one({
            "id": gen_id(),
            "producer_id": producer_id,
            "producer_name": producer["full_name"],
            "producer_location": producer["location"],
            "active": True,
            "rating_avg": 4.5, "rating_count": 8,
            "created_at": now_iso(),
            **p,
        })

    # Services
    await db.services.delete_many({"expert_id": vet_id})
    services = [
        {"title": "Consulta veterinaria virtual", "category": "consulta_virtual",
         "price": 35000, "duration_minutes": 30,
         "description": "Consulta por videollamada para tu ganado o aves. Diagnóstico inicial y recomendaciones.",
         "image_url": "https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=800"},
        {"title": "Visita técnica a finca", "category": "visita_finca",
         "price": 180000, "duration_minutes": 120,
         "description": "Diagnóstico integral en sitio: instalaciones, sanidad, alimentación.",
         "image_url": "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800"},
        {"title": "Asesoría en sanidad bovina", "category": "asesoria_tecnica",
         "price": 65000, "duration_minutes": 45,
         "description": "Plan sanitario personalizado: vacunación, desparasitación y nutrición.",
         "image_url": "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=800"},
        {"title": "Capacitación: gallineros saludables", "category": "capacitacion",
         "price": 45000, "duration_minutes": 60,
         "description": "Aprende a manejar tu gallinero para máxima producción de huevos.",
         "image_url": "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800"},
    ]
    for s in services:
        await db.services.insert_one({
            "id": gen_id(),
            "expert_id": vet_id,
            "expert_name": vet["full_name"],
            "expert_specialty": vet["specialty"],
            "expert_location": vet["location"],
            "active": True,
            "rating_avg": 4.8, "rating_count": 14,
            "created_at": now_iso(),
            **s,
        })

    # Articles
    await db.articles.delete_many({"author_id": {"$in": [vet_id, producer_id]}})
    articles = [
        {"author_id": vet_id, "author_name": vet["full_name"], "author_role": "veterinario",
         "title": "5 señales de que tu vaca necesita atención veterinaria",
         "content": "Conocer a tu animal es clave. Aquí cinco señales que no debes ignorar:\n\n1. Pérdida de apetito por más de 24 horas\n2. Cambios en la postura o caminar\n3. Disminución repentina en la producción de leche\n4. Secreciones inusuales (ojos, nariz, ubre)\n5. Aislamiento del rebaño\n\nAnte cualquiera de estas señales, consulta con un veterinario.",
         "category": "salud_animal",
         "image_url": "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=1200",
         "tags": ["bovinos", "salud"]},
        {"author_id": producer_id, "author_name": producer["full_name"], "author_role": "productor",
         "title": "Cómo iniciar un huerto orgánico en tu finca",
         "content": "Empezar un huerto orgánico es más fácil de lo que parece. Lo principal es:\n\n• Preparar bien la tierra con compost\n• Elegir cultivos adaptados al clima\n• Rotar cultivos cada temporada\n• Asociar plantas (ej: maíz + frijol)\n• No usar químicos sintéticos\n\nEn dos meses ya tendrás cosecha.",
         "category": "cultivos",
         "image_url": "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=1200",
         "tags": ["huerto", "orgánico"]},
        {"author_id": vet_id, "author_name": vet["full_name"], "author_role": "veterinario",
         "title": "Sostenibilidad: el agua es vida en el campo",
         "content": "El uso responsable del agua define el futuro de nuestras fincas. Riego por goteo, recolección de aguas lluvias y reservorios pequeños pueden reducir hasta 60% el consumo. Combina con cobertura vegetal para mantener humedad.",
         "category": "sostenibilidad",
         "image_url": "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=1200",
         "tags": ["agua", "sostenibilidad"]},
    ]
    for a in articles:
        await db.articles.insert_one({
            "id": gen_id(),
            "likes": 7,
            "created_at": now_iso(),
            **a,
        })

    print("✅ Seed completed:")
    print(f"  Producer: campesino@rurapp.co / rurapp123")
    print(f"  Vet:      vet@rurapp.co / rurapp123")
    print(f"  Cliente:  cliente@rurapp.co / rurapp123")
    print(f"  Products: {len(products)} | Services: {len(services)} | Articles: {len(articles)}")


if __name__ == "__main__":
    asyncio.run(seed())
