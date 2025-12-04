from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import random
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'solo-leveling-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    hunter_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CompleteQuest(BaseModel):
    quest_id: str

class GuildCreate(BaseModel):
    name: str
    description: str

class GuildJoin(BaseModel):
    guild_id: str

class ShopPurchase(BaseModel):
    item_id: str

class StatUpgrade(BaseModel):
    stat_name: str
    points: int = 1

class TrainingSession(BaseModel):
    quest_id: str
    exercise_index: int
    completed_reps: int

class StartTraining(BaseModel):
    quest_id: str

# ============== HELPERS ==============

def clean_mongo_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, dict):
        cleaned = {}
        for key, value in doc.items():
            if key == '_id' or isinstance(value, ObjectId):
                continue
            elif isinstance(value, dict):
                cleaned[key] = clean_mongo_doc(value)
            elif isinstance(value, list):
                cleaned[key] = [clean_mongo_doc(item) if isinstance(item, dict) else item for item in value]
            else:
                cleaned[key] = value
        return cleaned
    return doc

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_rank(level: int) -> str:
    if level >= 80: return "S"
    if level >= 60: return "A"
    if level >= 40: return "B"
    if level >= 25: return "C"
    if level >= 10: return "D"
    return "E"

def calculate_exp_needed(level: int) -> int:
    # Más difícil subir de nivel - exponencial más agresivo
    return int(150 * (1.8 ** (level - 1)))

# ENTRENAMIENTO PROGRESIVO HASTA NIVEL 50 (SUNG JIN-WOO)
# Nivel 1: 10 flexiones, 10 sentadillas, 10 abdominales, 1km
# Nivel 50+: 100 flexiones, 100 sentadillas, 100 abdominales, 10km
def get_training_reps(level: int, base_reps: int, max_reps: int) -> int:
    if level >= 50:
        return max_reps
    # Progresión lineal de nivel 1 a 50
    progress = (level - 1) / 49  # 0 a 1
    return int(base_reps + (max_reps - base_reps) * progress)

# Entrenamiento base del Sistema
BASE_DAILY_EXERCISES = [
    {"name": "Flexiones", "base_reps": 10, "max_reps": 100, "unit": "repeticiones", "stat": "strength"},
    {"name": "Sentadillas", "base_reps": 10, "max_reps": 100, "unit": "repeticiones", "stat": "endurance"},
    {"name": "Abdominales", "base_reps": 10, "max_reps": 100, "unit": "repeticiones", "stat": "vitality"},
    {"name": "Correr", "base_reps": 1, "max_reps": 10, "unit": "km", "stat": "agility"},
]

# MAZMORRAS Y MISIONES ESPECIALES - Desbloqueables por nivel
SPECIAL_DUNGEONS = [
    # Rango E - Nivel 1+
    {"id": "dungeon_prueba_novato", "name": "Prueba del Novato", "min_level": 1, "multiplier": 1.0, "difficulty": "E", "exp": 30, "gold": 20, "description": "Tu primera prueba como cazador."},
    {"id": "dungeon_cueva_goblins", "name": "Cueva de los Goblins", "min_level": 3, "multiplier": 1.2, "difficulty": "E", "exp": 50, "gold": 30, "description": "Una cueva infestada de goblins débiles."},
    {"id": "dungeon_bosque_oscuro", "name": "Bosque Oscuro", "min_level": 5, "multiplier": 1.3, "difficulty": "E", "exp": 70, "gold": 40, "description": "Un bosque lleno de criaturas nocturnas."},
    
    # Rango D - Nivel 10+
    {"id": "dungeon_mina_abandonada", "name": "Mina Abandonada", "min_level": 10, "multiplier": 1.5, "difficulty": "D", "exp": 100, "gold": 60, "description": "Una mina donde habitan bestias subterráneas."},
    {"id": "dungeon_templo_serpiente", "name": "Templo de la Serpiente", "min_level": 12, "multiplier": 1.6, "difficulty": "D", "exp": 130, "gold": 80, "description": "Un antiguo templo custodiado por serpientes gigantes."},
    {"id": "dungeon_pantano_veneno", "name": "Pantano Venenoso", "min_level": 15, "multiplier": 1.7, "difficulty": "D", "exp": 160, "gold": 100, "description": "Un pantano tóxico con criaturas mutadas."},
    {"id": "dungeon_ruinas_antiguas", "name": "Ruinas Antiguas", "min_level": 18, "multiplier": 1.8, "difficulty": "D", "exp": 200, "gold": 120, "description": "Ruinas de una civilización perdida."},
    
    # Rango C - Nivel 25+
    {"id": "dungeon_fortaleza_hielo", "name": "Fortaleza de Hielo", "min_level": 25, "multiplier": 2.0, "difficulty": "C", "exp": 300, "gold": 180, "description": "Una fortaleza congelada con guerreros de hielo."},
    {"id": "dungeon_volcan_activo", "name": "Volcán Activo", "min_level": 28, "multiplier": 2.2, "difficulty": "C", "exp": 380, "gold": 220, "description": "El interior de un volcán con elementales de fuego."},
    {"id": "dungeon_cementerio_maldito", "name": "Cementerio Maldito", "min_level": 32, "multiplier": 2.4, "difficulty": "C", "exp": 450, "gold": 280, "description": "Un cementerio donde los muertos caminan."},
    {"id": "dungeon_laboratorio_demonios", "name": "Laboratorio de Demonios", "min_level": 36, "multiplier": 2.6, "difficulty": "C", "exp": 550, "gold": 350, "description": "Un laboratorio secreto con experimentos demoníacos."},
    
    # Rango B - Nivel 40+
    {"id": "dungeon_castillo_vampiro", "name": "Castillo del Vampiro", "min_level": 40, "multiplier": 3.0, "difficulty": "B", "exp": 700, "gold": 450, "description": "El castillo de un antiguo vampiro noble."},
    {"id": "dungeon_abismo_oscuridad", "name": "Abismo de la Oscuridad", "min_level": 44, "multiplier": 3.3, "difficulty": "B", "exp": 900, "gold": 550, "description": "Un abismo donde la luz no existe."},
    {"id": "dungeon_torre_demonio", "name": "Torre del Demonio", "min_level": 48, "multiplier": 3.6, "difficulty": "B", "exp": 1100, "gold": 700, "description": "Una torre custodiada por demonios menores."},
    {"id": "dungeon_dimension_caos", "name": "Dimensión del Caos", "min_level": 52, "multiplier": 3.8, "difficulty": "B", "exp": 1300, "gold": 850, "description": "Una grieta dimensional llena de criaturas caóticas."},
    
    # Rango A - Nivel 60+
    {"id": "dungeon_palacio_reyes", "name": "Palacio de los Reyes Caídos", "min_level": 60, "multiplier": 4.0, "difficulty": "A", "exp": 1800, "gold": 1100, "description": "El palacio de antiguos reyes demonios."},
    {"id": "dungeon_templo_gigantes", "name": "Templo de los Gigantes", "min_level": 65, "multiplier": 4.5, "difficulty": "A", "exp": 2200, "gold": 1400, "description": "Un templo construido por gigantes ancestrales."},
    {"id": "dungeon_santuario_dragon", "name": "Santuario del Dragón", "min_level": 70, "multiplier": 5.0, "difficulty": "A", "exp": 2800, "gold": 1800, "description": "El santuario de un dragón antiguo."},
    {"id": "dungeon_trono_sombras", "name": "Trono de las Sombras", "min_level": 75, "multiplier": 5.5, "difficulty": "A", "exp": 3500, "gold": 2200, "description": "Donde las sombras más poderosas residen."},
    
    # Rango S - Nivel 80+
    {"id": "dungeon_puerta_infierno", "name": "Puerta del Infierno", "min_level": 80, "multiplier": 6.0, "difficulty": "S", "exp": 5000, "gold": 3000, "description": "La entrada al inframundo mismo."},
    {"id": "dungeon_reino_demonios", "name": "Reino de los Demonios", "min_level": 85, "multiplier": 7.0, "difficulty": "S", "exp": 7000, "gold": 4500, "description": "El corazón del territorio demoníaco."},
    {"id": "dungeon_tumba_monarcas", "name": "Tumba de los Monarcas", "min_level": 90, "multiplier": 8.0, "difficulty": "S", "exp": 10000, "gold": 6000, "description": "Donde descansan los Monarcas caídos."},
    {"id": "dungeon_vacio_absoluto", "name": "Vacío Absoluto", "min_level": 95, "multiplier": 10.0, "difficulty": "S", "exp": 15000, "gold": 10000, "description": "El vacío entre dimensiones. Solo los más fuertes sobreviven."},
]

# MISIONES ESPECIALES - Desbloqueables por nivel
SPECIAL_MISSIONS = [
    # Nivel 1-10
    {"id": "mission_despertar", "name": "El Despertar", "min_level": 1, "description": "Completa 3 misiones diarias consecutivas.", "requirement": {"type": "streak", "value": 3}, "exp": 200, "gold": 100, "shadow": None},
    {"id": "mission_primer_paso", "name": "Primer Paso", "min_level": 1, "description": "Alcanza el nivel 5.", "requirement": {"type": "level", "value": 5}, "exp": 150, "gold": 80, "shadow": None},
    {"id": "mission_resistencia_basica", "name": "Resistencia Básica", "min_level": 5, "description": "Completa una mazmorra E sin fallar.", "requirement": {"type": "dungeon_rank", "value": "E"}, "exp": 180, "gold": 90, "shadow": None},
    
    # Nivel 10-25
    {"id": "mission_cazador_real", "name": "Cazador de Verdad", "min_level": 10, "description": "Alcanza el rango D.", "requirement": {"type": "rank", "value": "D"}, "exp": 400, "gold": 250, "shadow": "shadow_goblin"},
    {"id": "mission_semana_hierro", "name": "Semana de Hierro", "min_level": 10, "description": "Mantén una racha de 7 días.", "requirement": {"type": "streak", "value": 7}, "exp": 600, "gold": 350, "shadow": None},
    {"id": "mission_dominador_d", "name": "Dominador de Rango D", "min_level": 15, "description": "Completa 5 mazmorras de rango D.", "requirement": {"type": "dungeon_count", "value": 5, "rank": "D"}, "exp": 800, "gold": 500, "shadow": None},
    {"id": "mission_fortaleza_mental", "name": "Fortaleza Mental", "min_level": 20, "description": "No falles ninguna misión en 10 días.", "requirement": {"type": "no_fail_streak", "value": 10}, "exp": 1000, "gold": 600, "shadow": "shadow_knight"},
    
    # Nivel 25-40
    {"id": "mission_ascenso_c", "name": "Ascenso al Rango C", "min_level": 25, "description": "Demuestra tu valía alcanzando el rango C.", "requirement": {"type": "rank", "value": "C"}, "exp": 1500, "gold": 900, "shadow": "shadow_mage"},
    {"id": "mission_mes_acero", "name": "Mes de Acero", "min_level": 25, "description": "Racha de 30 días consecutivos.", "requirement": {"type": "streak", "value": 30}, "exp": 3000, "gold": 1500, "shadow": "shadow_tank"},
    {"id": "mission_conquistador_c", "name": "Conquistador de Rango C", "min_level": 30, "description": "Completa 10 mazmorras de rango C.", "requirement": {"type": "dungeon_count", "value": 10, "rank": "C"}, "exp": 2500, "gold": 1200, "shadow": None},
    {"id": "mission_mil_repeticiones", "name": "Mil Repeticiones", "min_level": 35, "description": "Acumula 1000 repeticiones totales.", "requirement": {"type": "total_reps", "value": 1000}, "exp": 2000, "gold": 1000, "shadow": None},
    
    # Nivel 40-60
    {"id": "mission_elite_b", "name": "Élite Rango B", "min_level": 40, "description": "Alcanza el prestigioso rango B.", "requirement": {"type": "rank", "value": "B"}, "exp": 4000, "gold": 2500, "shadow": "shadow_assassin"},
    {"id": "mission_leyenda_100", "name": "Leyenda de los 100 Días", "min_level": 40, "description": "Racha de 100 días.", "requirement": {"type": "streak", "value": 100}, "exp": 10000, "gold": 5000, "shadow": "shadow_general"},
    {"id": "mission_sung_jinwoo", "name": "Entrenamiento de Sung Jin-Woo", "min_level": 50, "description": "Completa el entrenamiento completo: 100 flexiones, 100 sentadillas, 100 abdominales, 10km.", "requirement": {"type": "level", "value": 50}, "exp": 5000, "gold": 3000, "shadow": "shadow_beru"},
    {"id": "mission_destructor_b", "name": "Destructor de Rango B", "min_level": 50, "description": "Completa 15 mazmorras de rango B.", "requirement": {"type": "dungeon_count", "value": 15, "rank": "B"}, "exp": 6000, "gold": 3500, "shadow": None},
    
    # Nivel 60-80
    {"id": "mission_rango_a", "name": "Rango A - Los Elegidos", "min_level": 60, "description": "Únete a la élite del rango A.", "requirement": {"type": "rank", "value": "A"}, "exp": 8000, "gold": 5000, "shadow": "shadow_dragon"},
    {"id": "mission_aniquilador_a", "name": "Aniquilador de Rango A", "min_level": 70, "description": "Completa 20 mazmorras de rango A.", "requirement": {"type": "dungeon_count", "value": 20, "rank": "A"}, "exp": 12000, "gold": 7000, "shadow": "shadow_demon_lord"},
    {"id": "mission_10k_reps", "name": "Diez Mil Repeticiones", "min_level": 60, "description": "Acumula 10,000 repeticiones totales.", "requirement": {"type": "total_reps", "value": 10000}, "exp": 8000, "gold": 4000, "shadow": None},
    
    # Nivel 80+
    {"id": "mission_rango_s", "name": "Rango S - Monarca", "min_level": 80, "description": "Alcanza el rango supremo S.", "requirement": {"type": "rank", "value": "S"}, "exp": 20000, "gold": 12000, "shadow": "shadow_monarch"},
    {"id": "mission_aniquilador_s", "name": "Conquistador de Rango S", "min_level": 85, "description": "Completa 10 mazmorras de rango S.", "requirement": {"type": "dungeon_count", "value": 10, "rank": "S"}, "exp": 30000, "gold": 20000, "shadow": "shadow_sovereign"},
    {"id": "mission_ano_acero", "name": "Año de Acero", "min_level": 80, "description": "Racha de 365 días consecutivos.", "requirement": {"type": "streak", "value": 365}, "exp": 50000, "gold": 30000, "shadow": "shadow_ashborn"},
]

# JEFES ESPECIALES - Eventos semanales
WEEKLY_BOSSES = [
    {"id": "boss_igris", "name": "Igris, el Caballero de Sangre", "min_level": 20, "difficulty": "C", "multiplier": 4.0, "exp": 2000, "gold": 1200, "shadow": "shadow_igris", "description": "Un caballero leal que guarda su tumba por la eternidad."},
    {"id": "boss_tusk", "name": "Tusk, el Rey Orco", "min_level": 30, "difficulty": "B", "multiplier": 5.0, "exp": 4000, "gold": 2500, "shadow": "shadow_tusk", "description": "El rey de todos los orcos, temido por su brutalidad."},
    {"id": "boss_baran", "name": "Baran, el Rey Demonio", "min_level": 50, "difficulty": "A", "multiplier": 6.0, "exp": 8000, "gold": 5000, "shadow": "shadow_baran", "description": "Uno de los reyes demonio más poderosos."},
    {"id": "boss_ant_king", "name": "Rey de las Hormigas", "min_level": 60, "difficulty": "A", "multiplier": 7.0, "exp": 12000, "gold": 7500, "shadow": "shadow_beru", "description": "El temible rey de la isla Jeju."},
    {"id": "boss_legia", "name": "Legia, el Monarca de los Gigantes", "min_level": 75, "difficulty": "S", "multiplier": 8.0, "exp": 20000, "gold": 12000, "shadow": "shadow_legia", "description": "El Monarca que comanda a los gigantes."},
    {"id": "boss_querehsha", "name": "Querehsha, Monarca de la Plaga", "min_level": 85, "difficulty": "S", "multiplier": 9.0, "exp": 30000, "gold": 18000, "shadow": "shadow_querehsha", "description": "La Monarca de las enfermedades y la peste."},
    {"id": "boss_antares", "name": "Antares, Rey de los Dragones", "min_level": 95, "difficulty": "S", "multiplier": 12.0, "exp": 50000, "gold": 30000, "shadow": "shadow_antares", "description": "El más poderoso de todos los Monarcas."},
]

# SOMBRAS COLECCIONABLES
SHADOWS = {
    "shadow_goblin": {"name": "Goblin de Sombra", "rarity": "common", "stat_bonus": {"strength": 2}},
    "shadow_knight": {"name": "Caballero de Sombra", "rarity": "uncommon", "stat_bonus": {"endurance": 5}},
    "shadow_mage": {"name": "Mago de Sombra", "rarity": "uncommon", "stat_bonus": {"vitality": 5}},
    "shadow_tank": {"name": "Tanque de Sombra", "rarity": "rare", "stat_bonus": {"endurance": 10}},
    "shadow_assassin": {"name": "Asesino de Sombra", "rarity": "rare", "stat_bonus": {"agility": 10}},
    "shadow_general": {"name": "General de Sombra", "rarity": "epic", "stat_bonus": {"strength": 15}},
    "shadow_igris": {"name": "Igris", "rarity": "epic", "stat_bonus": {"strength": 10, "endurance": 10}},
    "shadow_tusk": {"name": "Tusk", "rarity": "epic", "stat_bonus": {"strength": 20}},
    "shadow_beru": {"name": "Beru", "rarity": "legendary", "stat_bonus": {"strength": 15, "agility": 15}},
    "shadow_dragon": {"name": "Dragón de Sombra", "rarity": "legendary", "stat_bonus": {"vitality": 25}},
    "shadow_baran": {"name": "Baran", "rarity": "legendary", "stat_bonus": {"strength": 20, "vitality": 10}},
    "shadow_demon_lord": {"name": "Señor Demonio", "rarity": "legendary", "stat_bonus": {"strength": 15, "endurance": 15}},
    "shadow_monarch": {"name": "Sombra del Monarca", "rarity": "mythic", "stat_bonus": {"strength": 25, "agility": 25}},
    "shadow_legia": {"name": "Legia", "rarity": "mythic", "stat_bonus": {"strength": 30, "endurance": 20}},
    "shadow_querehsha": {"name": "Querehsha", "rarity": "mythic", "stat_bonus": {"vitality": 40}},
    "shadow_sovereign": {"name": "Soberano de Sombra", "rarity": "mythic", "stat_bonus": {"strength": 30, "agility": 20, "vitality": 20}},
    "shadow_ashborn": {"name": "Ashborn - Monarca de las Sombras", "rarity": "divine", "stat_bonus": {"strength": 50, "agility": 50}},
    "shadow_antares": {"name": "Antares", "rarity": "divine", "stat_bonus": {"strength": 50, "endurance": 50, "vitality": 50}},
}

PUNISHMENT_QUESTS = [
    {"name": "Castigo: Resistencia Extrema", "exercises": [{"name": "Burpees", "reps": 50, "unit": "repeticiones"}], "exp": 30},
    {"name": "Castigo: Fuerza Mental", "exercises": [{"name": "Plancha", "reps": 5, "unit": "minutos"}], "exp": 40},
    {"name": "Castigo: Velocidad", "exercises": [{"name": "Sprint", "reps": 10, "unit": "sprints de 100m"}], "exp": 35},
    {"name": "Castigo: Core de Acero", "exercises": [{"name": "Plancha lateral", "reps": 3, "unit": "minutos por lado"}], "exp": 45},
    {"name": "Castigo: Piernas de Hierro", "exercises": [{"name": "Sentadillas con salto", "reps": 100, "unit": "repeticiones"}], "exp": 50},
]

SHOP_ITEMS = [
    {"id": "potion_exp_1", "name": "Poción de Experiencia", "description": "+50 EXP instantánea", "price": 150, "type": "consumable", "effect": {"exp": 50}},
    {"id": "potion_exp_2", "name": "Poción de Experiencia Mayor", "description": "+200 EXP instantánea", "price": 500, "type": "consumable", "effect": {"exp": 200}},
    {"id": "potion_exp_3", "name": "Elixir de Experiencia", "description": "+1000 EXP instantánea", "price": 2000, "type": "consumable", "effect": {"exp": 1000}},
    {"id": "title_shadow", "name": "Título: Monarca de las Sombras", "description": "Un título legendario", "price": 10000, "type": "title", "effect": {"title": "Monarca de las Sombras"}},
    {"id": "title_hunter", "name": "Título: Cazador Élite", "description": "Demuestra tu valía", "price": 2000, "type": "title", "effect": {"title": "Cazador Élite"}},
    {"id": "title_demon_slayer", "name": "Título: Exterminador de Demonios", "description": "Terror de los demonios", "price": 5000, "type": "title", "effect": {"title": "Exterminador de Demonios"}},
    {"id": "title_sovereign", "name": "Título: Soberano", "description": "El más alto honor", "price": 25000, "type": "title", "effect": {"title": "Soberano"}},
    {"id": "stat_str", "name": "Cristal de Fuerza", "description": "+3 Fuerza permanente", "price": 800, "type": "stat_boost", "effect": {"stat": "strength", "value": 3}},
    {"id": "stat_end", "name": "Cristal de Resistencia", "description": "+3 Resistencia permanente", "price": 800, "type": "stat_boost", "effect": {"stat": "endurance", "value": 3}},
    {"id": "stat_agi", "name": "Cristal de Agilidad", "description": "+3 Agilidad permanente", "price": 800, "type": "stat_boost", "effect": {"stat": "agility", "value": 3}},
    {"id": "stat_vit", "name": "Cristal de Vitalidad", "description": "+3 Vitalidad permanente", "price": 800, "type": "stat_boost", "effect": {"stat": "vitality", "value": 3}},
    {"id": "streak_protect", "name": "Escudo de Racha", "description": "Protege tu racha por 1 día si fallas", "price": 1500, "type": "consumable", "effect": {"streak_shield": 1}},
]

# LOGROS EXPANDIDOS
ACHIEVEMENTS = [
    # Misiones completadas
    {"id": "first_quest", "name": "Primer Paso", "description": "Completa tu primera misión", "reward_gold": 50, "category": "quests"},
    {"id": "quests_10", "name": "Dedicación", "description": "Completa 10 misiones", "reward_gold": 150, "category": "quests"},
    {"id": "quests_50", "name": "Imparable", "description": "Completa 50 misiones", "reward_gold": 500, "category": "quests"},
    {"id": "quests_100", "name": "Centurión", "description": "Completa 100 misiones", "reward_gold": 1000, "category": "quests"},
    {"id": "quests_500", "name": "Leyenda Viviente", "description": "Completa 500 misiones", "reward_gold": 5000, "category": "quests"},
    {"id": "quests_1000", "name": "Mil Batallas", "description": "Completa 1000 misiones", "reward_gold": 15000, "category": "quests"},
    
    # Niveles
    {"id": "level_10", "name": "Despertar", "description": "Alcanza el nivel 10", "reward_gold": 200, "category": "level"},
    {"id": "level_25", "name": "Cazador Rango C", "description": "Alcanza el nivel 25", "reward_gold": 500, "category": "level"},
    {"id": "level_40", "name": "Élite Rango B", "description": "Alcanza el nivel 40", "reward_gold": 1500, "category": "level"},
    {"id": "level_50", "name": "Entrenamiento Sung Jin-Woo", "description": "Alcanza el nivel 50 - Entrenamiento completo", "reward_gold": 3000, "category": "level"},
    {"id": "level_60", "name": "Rango A", "description": "Alcanza el nivel 60", "reward_gold": 5000, "category": "level"},
    {"id": "level_80", "name": "Rango S - Monarca", "description": "Alcanza el nivel 80", "reward_gold": 10000, "category": "level"},
    {"id": "level_100", "name": "Más Allá del Límite", "description": "Alcanza el nivel 100", "reward_gold": 25000, "category": "level"},
    
    # Rachas
    {"id": "streak_3", "name": "Inicio Prometedor", "description": "Racha de 3 días", "reward_gold": 100, "category": "streak"},
    {"id": "streak_7", "name": "Semana Perfecta", "description": "Racha de 7 días", "reward_gold": 300, "category": "streak"},
    {"id": "streak_14", "name": "Quincena de Hierro", "description": "Racha de 14 días", "reward_gold": 600, "category": "streak"},
    {"id": "streak_30", "name": "Mes de Acero", "description": "Racha de 30 días", "reward_gold": 1500, "category": "streak"},
    {"id": "streak_60", "name": "Voluntad Inquebrantable", "description": "Racha de 60 días", "reward_gold": 3000, "category": "streak"},
    {"id": "streak_100", "name": "Leyenda de los 100 Días", "description": "Racha de 100 días", "reward_gold": 5000, "category": "streak"},
    {"id": "streak_365", "name": "Año de Fuego", "description": "Racha de 365 días", "reward_gold": 30000, "category": "streak"},
    
    # Mazmorras
    {"id": "dungeon_first", "name": "Primera Mazmorra", "description": "Completa tu primera mazmorra", "reward_gold": 100, "category": "dungeon"},
    {"id": "dungeon_e_5", "name": "Cazador de Rango E", "description": "Completa 5 mazmorras E", "reward_gold": 200, "category": "dungeon"},
    {"id": "dungeon_d_5", "name": "Cazador de Rango D", "description": "Completa 5 mazmorras D", "reward_gold": 400, "category": "dungeon"},
    {"id": "dungeon_c_5", "name": "Cazador de Rango C", "description": "Completa 5 mazmorras C", "reward_gold": 800, "category": "dungeon"},
    {"id": "dungeon_b_5", "name": "Cazador de Rango B", "description": "Completa 5 mazmorras B", "reward_gold": 1500, "category": "dungeon"},
    {"id": "dungeon_a_5", "name": "Cazador de Rango A", "description": "Completa 5 mazmorras A", "reward_gold": 3000, "category": "dungeon"},
    {"id": "dungeon_s", "name": "Conquistador S", "description": "Completa una mazmorra S", "reward_gold": 5000, "category": "dungeon"},
    {"id": "dungeon_s_10", "name": "Maestro de Rango S", "description": "Completa 10 mazmorras S", "reward_gold": 15000, "category": "dungeon"},
    
    # Jefes
    {"id": "boss_first", "name": "Cazador de Jefes", "description": "Derrota a tu primer jefe", "reward_gold": 500, "category": "boss"},
    {"id": "boss_igris", "name": "Victoria sobre Igris", "description": "Derrota a Igris", "reward_gold": 1000, "category": "boss"},
    {"id": "boss_beru", "name": "Rey de las Hormigas Caído", "description": "Derrota al Rey de las Hormigas", "reward_gold": 5000, "category": "boss"},
    {"id": "boss_antares", "name": "Matador de Dragones", "description": "Derrota a Antares", "reward_gold": 25000, "category": "boss"},
    {"id": "boss_all", "name": "Aniquilador de Monarcas", "description": "Derrota a todos los jefes", "reward_gold": 50000, "category": "boss"},
    
    # Sombras
    {"id": "shadow_first", "name": "Necromante", "description": "Obtén tu primera sombra", "reward_gold": 200, "category": "shadow"},
    {"id": "shadow_5", "name": "Comandante de Sombras", "description": "Obtén 5 sombras", "reward_gold": 800, "category": "shadow"},
    {"id": "shadow_10", "name": "Señor de las Sombras", "description": "Obtén 10 sombras", "reward_gold": 2000, "category": "shadow"},
    {"id": "shadow_legendary", "name": "Coleccionista Legendario", "description": "Obtén una sombra legendaria", "reward_gold": 3000, "category": "shadow"},
    {"id": "shadow_mythic", "name": "Coleccionista Mítico", "description": "Obtén una sombra mítica", "reward_gold": 8000, "category": "shadow"},
    {"id": "shadow_divine", "name": "Coleccionista Divino", "description": "Obtén una sombra divina", "reward_gold": 20000, "category": "shadow"},
    
    # Gremios
    {"id": "guild_join", "name": "Compañero", "description": "Únete a un gremio", "reward_gold": 100, "category": "guild"},
    {"id": "guild_create", "name": "Líder", "description": "Crea un gremio", "reward_gold": 300, "category": "guild"},
    
    # Estadísticas
    {"id": "stats_50", "name": "Cuerpo Fortalecido", "description": "Una estadística alcanza 50", "reward_gold": 500, "category": "stats"},
    {"id": "stats_100", "name": "Cuerpo de Acero", "description": "Una estadística alcanza 100", "reward_gold": 2000, "category": "stats"},
    {"id": "stats_all_50", "name": "Equilibrio Perfecto", "description": "Todas las estadísticas en 50+", "reward_gold": 3000, "category": "stats"},
    
    # Repeticiones totales
    {"id": "reps_1000", "name": "Mil Movimientos", "description": "1,000 repeticiones totales", "reward_gold": 300, "category": "reps"},
    {"id": "reps_10000", "name": "Diez Mil Movimientos", "description": "10,000 repeticiones totales", "reward_gold": 1500, "category": "reps"},
    {"id": "reps_100000", "name": "Cien Mil Movimientos", "description": "100,000 repeticiones totales", "reward_gold": 10000, "category": "reps"},
]

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    existing_name = await db.users.find_one({"hunter_name": user_data.hunter_name})
    if existing_name:
        raise HTTPException(status_code=400, detail="El nombre de cazador ya existe")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "hunter_name": user_data.hunter_name,
        "level": 1,
        "experience": 0,
        "rank": "E",
        "gold": 100,
        "title": "Novato",
        "stats": {"strength": 10, "endurance": 10, "agility": 10, "vitality": 10},
        "stat_points": 0,
        "guild_id": None,
        "achievements": [],
        "quests_completed": 0,
        "inventory": [],
        "active_quests": [],
        "punishment_quests": [],
        "shadows": [],
        "streak": 0,
        "best_streak": 0,
        "last_quest_date": None,
        "total_reps": 0,
        "dungeons_completed": {"E": 0, "D": 0, "C": 0, "B": 0, "A": 0, "S": 0},
        "bosses_defeated": [],
        "special_missions_completed": [],
        "streak_shields": 0,
        "training_start_time": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id)
    return {"token": token, "user_id": user_id, "hunter_name": user_data.hunter_name}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user["id"])
    return {"token": token, "user_id": user["id"], "hunter_name": user["hunter_name"]}

# ============== USER ENDPOINTS ==============

@api_router.get("/user/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    # Calculate total shadow bonuses
    shadow_bonuses = {"strength": 0, "endurance": 0, "agility": 0, "vitality": 0}
    for shadow_id in user.get("shadows", []):
        if shadow_id in SHADOWS:
            for stat, bonus in SHADOWS[shadow_id].get("stat_bonus", {}).items():
                shadow_bonuses[stat] = shadow_bonuses.get(stat, 0) + bonus
    
    return {
        "id": user["id"],
        "email": user["email"],
        "hunter_name": user["hunter_name"],
        "level": user["level"],
        "experience": user["experience"],
        "exp_to_next": calculate_exp_needed(user["level"]),
        "rank": user["rank"],
        "gold": user["gold"],
        "title": user["title"],
        "stats": user["stats"],
        "shadow_bonuses": shadow_bonuses,
        "stat_points": user.get("stat_points", 0),
        "guild_id": user.get("guild_id"),
        "achievements": user.get("achievements", []),
        "quests_completed": user.get("quests_completed", 0),
        "inventory": user.get("inventory", []),
        "shadows": user.get("shadows", []),
        "streak": user.get("streak", 0),
        "best_streak": user.get("best_streak", 0),
        "total_reps": user.get("total_reps", 0),
        "dungeons_completed": user.get("dungeons_completed", {"E": 0, "D": 0, "C": 0, "B": 0, "A": 0, "S": 0}),
        "bosses_defeated": user.get("bosses_defeated", []),
        "special_missions_completed": user.get("special_missions_completed", []),
        "streak_shields": user.get("streak_shields", 0),
        "training_start_time": user.get("training_start_time"),
        "created_at": user["created_at"],
    }

@api_router.get("/user/stats")
async def get_user_stats(user: dict = Depends(get_current_user)):
    """Get detailed statistics for the user"""
    return {
        "level": user["level"],
        "quests_completed": user.get("quests_completed", 0),
        "streak": user.get("streak", 0),
        "best_streak": user.get("best_streak", 0),
        "total_reps": user.get("total_reps", 0),
        "dungeons_completed": user.get("dungeons_completed", {}),
        "bosses_defeated": len(user.get("bosses_defeated", [])),
        "shadows_collected": len(user.get("shadows", [])),
        "achievements_unlocked": len(user.get("achievements", [])),
        "total_achievements": len(ACHIEVEMENTS),
        "days_since_start": (datetime.now(timezone.utc) - datetime.fromisoformat(user["created_at"].replace('Z', '+00:00'))).days if user.get("created_at") else 0,
    }

@api_router.post("/user/upgrade-stat")
async def upgrade_stat(data: StatUpgrade, user: dict = Depends(get_current_user)):
    stat_points = user.get("stat_points", 0)
    if stat_points < data.points:
        raise HTTPException(status_code=400, detail="No tienes suficientes puntos de estadística")
    
    if data.stat_name not in ["strength", "endurance", "agility", "vitality"]:
        raise HTTPException(status_code=400, detail="Estadística inválida")
    
    new_stat_value = user["stats"][data.stat_name] + data.points
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {
                f"stats.{data.stat_name}": data.points,
                "stat_points": -data.points
            }
        }
    )
    
    # Check stat achievements
    achievements_unlocked = []
    if new_stat_value >= 50 and "stats_50" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "stats_50")
        if ach:
            achievements_unlocked.append(ach)
    if new_stat_value >= 100 and "stats_100" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "stats_100")
        if ach:
            achievements_unlocked.append(ach)
    
    return {"success": True, "message": f"{data.stat_name} aumentada en {data.points}", "achievements_unlocked": achievements_unlocked}

# ============== QUESTS ENDPOINTS ==============

@api_router.get("/quests/daily")
async def get_daily_quests(user: dict = Depends(get_current_user)):
    level = user["level"]
    
    exercises = []
    for ex in BASE_DAILY_EXERCISES:
        reps = get_training_reps(level, ex["base_reps"], ex["max_reps"])
        exercises.append({
            "name": ex["name"],
            "reps": reps,
            "unit": ex["unit"],
            "stat": ex["stat"],
            "completed": False
        })
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.daily_quests.find_one({"user_id": user["id"], "date": today})
    
    if existing:
        cleaned = clean_mongo_doc(existing)
        if "user_id" in cleaned:
            del cleaned["user_id"]
        return cleaned
    
    # Calculate reduced rewards
    base_exp = 25 + (level * 2)  # Reduced from 50
    base_gold = 10 + level  # Reduced from 20
    
    quest = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "date": today,
        "name": "Entrenamiento Diario del Sistema",
        "description": f"Completa el entrenamiento básico. Nivel {level}" + (" - ENTRENAMIENTO SUNG JIN-WOO" if level >= 50 else ""),
        "quest_type": "daily",
        "exercises": exercises,
        "exp_reward": base_exp,
        "gold_reward": base_gold,
        "time_limit_hours": 24,
        "difficulty": calculate_rank(level),
        "is_completed": False,
        "exercises_progress": [False] * len(exercises),
        "deadline": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    quest_to_insert = quest.copy()
    await db.daily_quests.insert_one(quest_to_insert)
    
    response_quest = clean_mongo_doc(quest)
    if "user_id" in response_quest:
        del response_quest["user_id"]
    return response_quest

@api_router.get("/quests/special")
async def get_special_quests(user: dict = Depends(get_current_user)):
    level = user["level"]
    
    available_dungeons = []
    for dungeon in SPECIAL_DUNGEONS:
        if level >= dungeon["min_level"]:
            exercises = []
            for ex in BASE_DAILY_EXERCISES:
                base_reps = get_training_reps(level, ex["base_reps"], ex["max_reps"])
                reps = int(base_reps * dungeon["multiplier"])
                exercises.append({"name": ex["name"], "reps": reps, "unit": ex["unit"], "stat": ex["stat"]})
            
            available_dungeons.append({
                "id": dungeon["id"],
                "name": dungeon["name"],
                "description": dungeon["description"],
                "quest_type": "special",
                "exercises": exercises,
                "exp_reward": dungeon["exp"],
                "gold_reward": dungeon["gold"],
                "time_limit_hours": 48,
                "difficulty": dungeon["difficulty"],
                "min_level": dungeon["min_level"],
                "is_completed": False
            })
    
    return available_dungeons

@api_router.get("/quests/weekly-boss")
async def get_weekly_boss(user: dict = Depends(get_current_user)):
    level = user["level"]
    
    available_bosses = []
    for boss in WEEKLY_BOSSES:
        if level >= boss["min_level"]:
            exercises = []
            for ex in BASE_DAILY_EXERCISES:
                base_reps = get_training_reps(level, ex["base_reps"], ex["max_reps"])
                reps = int(base_reps * boss["multiplier"])
                exercises.append({"name": ex["name"], "reps": reps, "unit": ex["unit"], "stat": ex["stat"]})
            
            already_defeated = boss["id"] in user.get("bosses_defeated", [])
            
            available_bosses.append({
                "id": boss["id"],
                "name": boss["name"],
                "description": boss["description"],
                "quest_type": "boss",
                "exercises": exercises,
                "exp_reward": boss["exp"],
                "gold_reward": boss["gold"],
                "difficulty": boss["difficulty"],
                "min_level": boss["min_level"],
                "shadow_reward": boss.get("shadow"),
                "already_defeated": already_defeated
            })
    
    return available_bosses

@api_router.get("/quests/special-missions")
async def get_special_missions(user: dict = Depends(get_current_user)):
    level = user["level"]
    completed = user.get("special_missions_completed", [])
    
    available_missions = []
    for mission in SPECIAL_MISSIONS:
        if level >= mission["min_level"]:
            is_completed = mission["id"] in completed
            
            # Check if requirements are met
            req = mission["requirement"]
            can_complete = False
            progress = 0
            target = req.get("value", 0)
            
            if req["type"] == "streak":
                progress = user.get("streak", 0)
                can_complete = progress >= target
            elif req["type"] == "level":
                progress = level
                can_complete = progress >= target
            elif req["type"] == "rank":
                rank_order = {"E": 1, "D": 2, "C": 3, "B": 4, "A": 5, "S": 6}
                progress = rank_order.get(user["rank"], 0)
                target = rank_order.get(req["value"], 0)
                can_complete = progress >= target
            elif req["type"] == "dungeon_count":
                dungeon_rank = req.get("rank", "E")
                progress = user.get("dungeons_completed", {}).get(dungeon_rank, 0)
                can_complete = progress >= target
            elif req["type"] == "total_reps":
                progress = user.get("total_reps", 0)
                can_complete = progress >= target
            elif req["type"] == "no_fail_streak":
                progress = user.get("streak", 0)
                can_complete = progress >= target
            
            available_missions.append({
                "id": mission["id"],
                "name": mission["name"],
                "description": mission["description"],
                "exp_reward": mission["exp"],
                "gold_reward": mission["gold"],
                "shadow_reward": mission.get("shadow"),
                "is_completed": is_completed,
                "can_complete": can_complete and not is_completed,
                "progress": progress,
                "target": target,
                "min_level": mission["min_level"]
            })
    
    return available_missions

@api_router.get("/quests/punishment")
async def get_punishment_quests(user: dict = Depends(get_current_user)):
    return user.get("punishment_quests", [])

@api_router.post("/quests/start-training")
async def start_training(data: StartTraining, user: dict = Depends(get_current_user)):
    """Start the training timer"""
    start_time = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"training_start_time": start_time}}
    )
    return {"success": True, "start_time": start_time}

@api_router.post("/quests/complete")
async def complete_quest(data: CompleteQuest, user: dict = Depends(get_current_user)):
    quest_id = data.quest_id
    
    # Check daily quest
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily = await db.daily_quests.find_one({"id": quest_id, "user_id": user["id"]})
    daily = clean_mongo_doc(daily)
    
    shadow_earned = None
    total_reps_gained = 0
    
    if daily:
        if daily["is_completed"]:
            raise HTTPException(status_code=400, detail="Misión ya completada")
        
        # Calculate total reps
        for ex in daily.get("exercises", []):
            if ex["unit"] == "repeticiones":
                total_reps_gained += ex["reps"]
            elif ex["unit"] == "km":
                total_reps_gained += ex["reps"] * 100  # 1km = 100 "reps"
        
        await db.daily_quests.update_one({"id": quest_id}, {"$set": {"is_completed": True}})
        exp_reward = daily["exp_reward"]
        gold_reward = daily["gold_reward"]
        
        # Update streak
        last_date = user.get("last_quest_date")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        
        if last_date == yesterday or last_date == today:
            new_streak = user.get("streak", 0) + (0 if last_date == today else 1)
        elif last_date is None:
            new_streak = 1
        else:
            new_streak = 1  # Streak broken
        
        best_streak = max(new_streak, user.get("best_streak", 0))
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "streak": new_streak,
                "best_streak": best_streak,
                "last_quest_date": today,
                "training_start_time": None
            }}
        )
        
    elif quest_id.startswith("dungeon_"):
        # Special dungeon quest
        dungeon = next((d for d in SPECIAL_DUNGEONS if d["id"] == quest_id), None)
        if not dungeon:
            raise HTTPException(status_code=404, detail="Mazmorra no encontrada")
        if user["level"] < dungeon["min_level"]:
            raise HTTPException(status_code=400, detail=f"Necesitas nivel {dungeon['min_level']}")
        
        exp_reward = dungeon["exp"]
        gold_reward = dungeon["gold"]
        
        # Calculate reps
        for ex in BASE_DAILY_EXERCISES:
            base_reps = get_training_reps(user["level"], ex["base_reps"], ex["max_reps"])
            reps = int(base_reps * dungeon["multiplier"])
            if ex["unit"] == "repeticiones":
                total_reps_gained += reps
            elif ex["unit"] == "km":
                total_reps_gained += reps * 100
        
        # Update dungeon count
        rank = dungeon["difficulty"]
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {f"dungeons_completed.{rank}": 1}}
        )
        
    elif quest_id.startswith("boss_"):
        # Boss fight
        boss = next((b for b in WEEKLY_BOSSES if b["id"] == quest_id), None)
        if not boss:
            raise HTTPException(status_code=404, detail="Jefe no encontrado")
        if user["level"] < boss["min_level"]:
            raise HTTPException(status_code=400, detail=f"Necesitas nivel {boss['min_level']}")
        
        exp_reward = boss["exp"]
        gold_reward = boss["gold"]
        
        # Calculate reps
        for ex in BASE_DAILY_EXERCISES:
            base_reps = get_training_reps(user["level"], ex["base_reps"], ex["max_reps"])
            reps = int(base_reps * boss["multiplier"])
            if ex["unit"] == "repeticiones":
                total_reps_gained += reps
            elif ex["unit"] == "km":
                total_reps_gained += reps * 100
        
        # Add shadow if not already owned
        if boss.get("shadow") and boss["shadow"] not in user.get("shadows", []):
            shadow_earned = boss["shadow"]
            await db.users.update_one(
                {"id": user["id"]},
                {"$addToSet": {"shadows": shadow_earned, "bosses_defeated": quest_id}}
            )
        else:
            await db.users.update_one(
                {"id": user["id"]},
                {"$addToSet": {"bosses_defeated": quest_id}}
            )
        
    elif quest_id.startswith("punishment_"):
        # Punishment quest
        punishments = user.get("punishment_quests", [])
        punishment = next((p for p in punishments if p["id"] == quest_id), None)
        if not punishment:
            raise HTTPException(status_code=404, detail="Castigo no encontrado")
        
        exp_reward = punishment["exp_reward"]
        gold_reward = 0
        
        # Calculate reps
        for ex in punishment.get("exercises", []):
            if ex["unit"] == "repeticiones":
                total_reps_gained += ex["reps"]
        
        await db.users.update_one(
            {"id": user["id"]},
            {"$pull": {"punishment_quests": {"id": quest_id}}}
        )
        
    elif quest_id.startswith("mission_"):
        # Special mission
        mission = next((m for m in SPECIAL_MISSIONS if m["id"] == quest_id), None)
        if not mission:
            raise HTTPException(status_code=404, detail="Misión especial no encontrada")
        if quest_id in user.get("special_missions_completed", []):
            raise HTTPException(status_code=400, detail="Misión ya completada")
        
        exp_reward = mission["exp"]
        gold_reward = mission["gold"]
        
        # Add shadow if available
        if mission.get("shadow") and mission["shadow"] not in user.get("shadows", []):
            shadow_earned = mission["shadow"]
            await db.users.update_one(
                {"id": user["id"]},
                {"$addToSet": {"shadows": shadow_earned, "special_missions_completed": quest_id}}
            )
        else:
            await db.users.update_one(
                {"id": user["id"]},
                {"$addToSet": {"special_missions_completed": quest_id}}
            )
    else:
        raise HTTPException(status_code=404, detail="Misión no encontrada")
    
    # Update user
    new_exp = user["experience"] + exp_reward
    new_level = user["level"]
    stat_points_gained = 0
    exp_needed = calculate_exp_needed(new_level)
    
    while new_exp >= exp_needed:
        new_exp -= exp_needed
        new_level += 1
        stat_points_gained += 3
        exp_needed = calculate_exp_needed(new_level)
    
    new_rank = calculate_rank(new_level)
    quests_completed = user.get("quests_completed", 0) + 1
    new_total_reps = user.get("total_reps", 0) + total_reps_gained
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "experience": new_exp,
                "level": new_level,
                "rank": new_rank,
            },
            "$inc": {
                "gold": gold_reward,
                "stat_points": stat_points_gained,
                "quests_completed": 1,
                "total_reps": total_reps_gained
            }
        }
    )
    
    # Check achievements
    achievements_unlocked = []
    
    # Quest achievements
    if quests_completed == 1:
        ach = await unlock_achievement(user["id"], "first_quest")
        if ach: achievements_unlocked.append(ach)
    if quests_completed >= 10 and "quests_10" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "quests_10")
        if ach: achievements_unlocked.append(ach)
    if quests_completed >= 50 and "quests_50" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "quests_50")
        if ach: achievements_unlocked.append(ach)
    if quests_completed >= 100 and "quests_100" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "quests_100")
        if ach: achievements_unlocked.append(ach)
    if quests_completed >= 500 and "quests_500" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "quests_500")
        if ach: achievements_unlocked.append(ach)
    if quests_completed >= 1000 and "quests_1000" not in user.get("achievements", []):
        ach = await unlock_achievement(user["id"], "quests_1000")
        if ach: achievements_unlocked.append(ach)
    
    # Level achievements
    level_achievements = [
        (10, "level_10"), (25, "level_25"), (40, "level_40"),
        (50, "level_50"), (60, "level_60"), (80, "level_80"), (100, "level_100")
    ]
    for lvl, ach_id in level_achievements:
        if new_level >= lvl and ach_id not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], ach_id)
            if ach: achievements_unlocked.append(ach)
    
    # Streak achievements  
    streak = user.get("streak", 0)
    if daily:  # Only check streak if completing daily quest
        streak_achievements = [
            (3, "streak_3"), (7, "streak_7"), (14, "streak_14"),
            (30, "streak_30"), (60, "streak_60"), (100, "streak_100"), (365, "streak_365")
        ]
        for streak_val, ach_id in streak_achievements:
            if streak >= streak_val and ach_id not in user.get("achievements", []):
                ach = await unlock_achievement(user["id"], ach_id)
                if ach: achievements_unlocked.append(ach)
    
    # Reps achievements
    reps_achievements = [(1000, "reps_1000"), (10000, "reps_10000"), (100000, "reps_100000")]
    for reps_val, ach_id in reps_achievements:
        if new_total_reps >= reps_val and ach_id not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], ach_id)
            if ach: achievements_unlocked.append(ach)
    
    # Dungeon achievements
    if quest_id.startswith("dungeon_"):
        dungeon = next((d for d in SPECIAL_DUNGEONS if d["id"] == quest_id), None)
        if dungeon:
            if "dungeon_first" not in user.get("achievements", []):
                ach = await unlock_achievement(user["id"], "dungeon_first")
                if ach: achievements_unlocked.append(ach)
            
            rank = dungeon["difficulty"]
            current_count = user.get("dungeons_completed", {}).get(rank, 0) + 1
            dungeon_achievements = {
                "E": (5, "dungeon_e_5"),
                "D": (5, "dungeon_d_5"),
                "C": (5, "dungeon_c_5"),
                "B": (5, "dungeon_b_5"),
                "A": (5, "dungeon_a_5"),
                "S": (1, "dungeon_s"),
            }
            if rank in dungeon_achievements:
                count_needed, ach_id = dungeon_achievements[rank]
                if current_count >= count_needed and ach_id not in user.get("achievements", []):
                    ach = await unlock_achievement(user["id"], ach_id)
                    if ach: achievements_unlocked.append(ach)
            
            if rank == "S":
                s_count = user.get("dungeons_completed", {}).get("S", 0) + 1
                if s_count >= 10 and "dungeon_s_10" not in user.get("achievements", []):
                    ach = await unlock_achievement(user["id"], "dungeon_s_10")
                    if ach: achievements_unlocked.append(ach)
    
    # Boss achievements
    if quest_id.startswith("boss_"):
        if "boss_first" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "boss_first")
            if ach: achievements_unlocked.append(ach)
        
        boss_specific = {
            "boss_igris": "boss_igris",
            "boss_ant_king": "boss_beru",
            "boss_antares": "boss_antares"
        }
        if quest_id in boss_specific and boss_specific[quest_id] not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], boss_specific[quest_id])
            if ach: achievements_unlocked.append(ach)
        
        # Check if all bosses defeated
        all_boss_ids = [b["id"] for b in WEEKLY_BOSSES]
        bosses_defeated = user.get("bosses_defeated", []) + [quest_id]
        if all(b in bosses_defeated for b in all_boss_ids) and "boss_all" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "boss_all")
            if ach: achievements_unlocked.append(ach)
    
    # Shadow achievements
    if shadow_earned:
        shadows = user.get("shadows", []) + [shadow_earned]
        shadow_count = len(shadows)
        
        if shadow_count == 1:
            ach = await unlock_achievement(user["id"], "shadow_first")
            if ach: achievements_unlocked.append(ach)
        if shadow_count >= 5 and "shadow_5" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "shadow_5")
            if ach: achievements_unlocked.append(ach)
        if shadow_count >= 10 and "shadow_10" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "shadow_10")
            if ach: achievements_unlocked.append(ach)
        
        # Rarity achievements
        shadow_info = SHADOWS.get(shadow_earned, {})
        rarity = shadow_info.get("rarity", "common")
        if rarity == "legendary" and "shadow_legendary" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "shadow_legendary")
            if ach: achievements_unlocked.append(ach)
        if rarity == "mythic" and "shadow_mythic" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "shadow_mythic")
            if ach: achievements_unlocked.append(ach)
        if rarity == "divine" and "shadow_divine" not in user.get("achievements", []):
            ach = await unlock_achievement(user["id"], "shadow_divine")
            if ach: achievements_unlocked.append(ach)
    
    return {
        "success": True,
        "exp_gained": exp_reward,
        "gold_gained": gold_reward,
        "new_level": new_level,
        "new_exp": new_exp,
        "exp_to_next": exp_needed,
        "new_rank": new_rank,
        "stat_points_gained": stat_points_gained,
        "level_up": new_level > user["level"],
        "achievements_unlocked": [a for a in achievements_unlocked if a],
        "shadow_earned": SHADOWS.get(shadow_earned) if shadow_earned else None,
        "reps_gained": total_reps_gained
    }

@api_router.post("/quests/fail")
async def fail_quest(data: CompleteQuest, user: dict = Depends(get_current_user)):
    # Check if user has streak shield
    shields = user.get("streak_shields", 0)
    streak_protected = False
    
    if shields > 0:
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"streak_shields": -1}}
        )
        streak_protected = True
    else:
        # Reset streak
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"streak": 0}}
        )
    
    # Add punishment quest and deduct experience
    punishment = random.choice(PUNISHMENT_QUESTS)
    punishment_quest = {
        "id": f"punishment_{str(uuid.uuid4())[:8]}",
        "name": punishment["name"],
        "exercises": punishment["exercises"],
        "exp_reward": punishment["exp"],
        "quest_type": "punishment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    exp_penalty = int(user["experience"] * 0.15)  # 15% exp loss
    new_exp = max(0, user["experience"] - exp_penalty)
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"experience": new_exp, "training_start_time": None},
            "$push": {"punishment_quests": punishment_quest}
        }
    )
    
    message = "[SISTEMA] Has fallado la misión. Se te ha asignado un castigo."
    if streak_protected:
        message += " Tu racha ha sido protegida por el Escudo de Racha."
    else:
        message += " Tu racha se ha reiniciado."
    
    return {
        "success": True,
        "exp_lost": exp_penalty,
        "punishment_assigned": punishment_quest["name"],
        "streak_protected": streak_protected,
        "message": message
    }

async def unlock_achievement(user_id: str, achievement_id: str):
    achievement = next((a for a in ACHIEVEMENTS if a["id"] == achievement_id), None)
    if not achievement:
        return None
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$addToSet": {"achievements": achievement_id},
            "$inc": {"gold": achievement["reward_gold"]}
        }
    )
    return achievement

# ============== SHOP ENDPOINTS ==============

@api_router.get("/shop/items")
async def get_shop_items(user: dict = Depends(get_current_user)):
    return SHOP_ITEMS

@api_router.post("/shop/buy")
async def buy_item(data: ShopPurchase, user: dict = Depends(get_current_user)):
    item = next((i for i in SHOP_ITEMS if i["id"] == data.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    if user["gold"] < item["price"]:
        raise HTTPException(status_code=400, detail="Oro insuficiente")
    
    update_ops = {"$inc": {"gold": -item["price"]}}
    
    if item["type"] == "consumable":
        if "exp" in item["effect"]:
            update_ops["$inc"]["experience"] = item["effect"]["exp"]
        if "gold" in item["effect"]:
            update_ops["$inc"]["gold"] = update_ops["$inc"].get("gold", 0) + item["effect"]["gold"]
        if "streak_shield" in item["effect"]:
            update_ops["$inc"]["streak_shields"] = item["effect"]["streak_shield"]
    elif item["type"] == "title":
        update_ops["$set"] = {"title": item["effect"]["title"]}
    elif item["type"] == "stat_boost":
        stat = item["effect"]["stat"]
        value = item["effect"]["value"]
        update_ops["$inc"][f"stats.{stat}"] = value
    
    await db.users.update_one({"id": user["id"]}, update_ops)
    
    return {"success": True, "message": f"Has comprado {item['name']}"}

# ============== SHADOWS ENDPOINTS ==============

@api_router.get("/shadows")
async def get_shadows(user: dict = Depends(get_current_user)):
    user_shadows = user.get("shadows", [])
    result = []
    for shadow_id, shadow_data in SHADOWS.items():
        result.append({
            "id": shadow_id,
            "name": shadow_data["name"],
            "rarity": shadow_data["rarity"],
            "stat_bonus": shadow_data["stat_bonus"],
            "owned": shadow_id in user_shadows
        })
    return result

# ============== GUILD ENDPOINTS ==============

@api_router.get("/guilds")
async def get_guilds():
    guilds = await db.guilds.find({}, {"_id": 0}).to_list(100)
    return guilds

@api_router.post("/guilds/create")
async def create_guild(data: GuildCreate, user: dict = Depends(get_current_user)):
    if user.get("guild_id"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un gremio")
    
    existing = await db.guilds.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un gremio con ese nombre")
    
    guild_id = str(uuid.uuid4())
    guild = {
        "id": guild_id,
        "name": data.name,
        "description": data.description,
        "leader_id": user["id"],
        "leader_name": user["hunter_name"],
        "members": [user["id"]],
        "member_count": 1,
        "total_level": user["level"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.guilds.insert_one(guild)
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"guild_id": guild_id}})
    
    if "guild_create" not in user.get("achievements", []):
        await unlock_achievement(user["id"], "guild_create")
    
    return {"success": True, "guild_id": guild_id, "message": f"Gremio '{data.name}' creado"}

@api_router.post("/guilds/join")
async def join_guild(data: GuildJoin, user: dict = Depends(get_current_user)):
    if user.get("guild_id"):
        raise HTTPException(status_code=400, detail="Ya perteneces a un gremio")
    
    guild = await db.guilds.find_one({"id": data.guild_id}, {"_id": 0})
    if not guild:
        raise HTTPException(status_code=404, detail="Gremio no encontrado")
    
    await db.guilds.update_one(
        {"id": data.guild_id},
        {
            "$push": {"members": user["id"]},
            "$inc": {"member_count": 1, "total_level": user["level"]}
        }
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"guild_id": data.guild_id}})
    
    if "guild_join" not in user.get("achievements", []):
        await unlock_achievement(user["id"], "guild_join")
    
    return {"success": True, "message": f"Te has unido al gremio '{guild['name']}'"}

@api_router.post("/guilds/leave")
async def leave_guild(user: dict = Depends(get_current_user)):
    if not user.get("guild_id"):
        raise HTTPException(status_code=400, detail="No perteneces a ningún gremio")
    
    guild = await db.guilds.find_one({"id": user["guild_id"]}, {"_id": 0})
    if guild and guild["leader_id"] == user["id"]:
        await db.guilds.delete_one({"id": user["guild_id"]})
        await db.users.update_many({"guild_id": user["guild_id"]}, {"$set": {"guild_id": None}})
    else:
        await db.guilds.update_one(
            {"id": user["guild_id"]},
            {
                "$pull": {"members": user["id"]},
                "$inc": {"member_count": -1, "total_level": -user["level"]}
            }
        )
        await db.users.update_one({"id": user["id"]}, {"$set": {"guild_id": None}})
    
    return {"success": True, "message": "Has abandonado el gremio"}

@api_router.get("/guilds/{guild_id}")
async def get_guild_details(guild_id: str):
    guild = await db.guilds.find_one({"id": guild_id}, {"_id": 0})
    if not guild:
        raise HTTPException(status_code=404, detail="Gremio no encontrado")
    
    members = await db.users.find(
        {"id": {"$in": guild["members"]}},
        {"_id": 0, "id": 1, "hunter_name": 1, "level": 1, "rank": 1}
    ).to_list(100)
    
    guild["members_info"] = members
    return guild

# ============== RANKING ENDPOINTS ==============

@api_router.get("/ranking")
async def get_ranking():
    users = await db.users.find(
        {},
        {"_id": 0, "id": 1, "hunter_name": 1, "level": 1, "rank": 1, "title": 1, "quests_completed": 1, "streak": 1}
    ).sort("level", -1).to_list(100)
    
    for i, user in enumerate(users):
        user["position"] = i + 1
    
    return users

@api_router.get("/ranking/guilds")
async def get_guild_ranking():
    guilds = await db.guilds.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "member_count": 1, "total_level": 1, "leader_name": 1}
    ).sort("total_level", -1).to_list(50)
    
    for i, guild in enumerate(guilds):
        guild["position"] = i + 1
    
    return guilds

# ============== ACHIEVEMENTS ENDPOINTS ==============

@api_router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    user_achievements = user.get("achievements", [])
    result = []
    for ach in ACHIEVEMENTS:
        result.append({
            **ach,
            "unlocked": ach["id"] in user_achievements
        })
    return result

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "Sistema Solo Leveling API v2.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
