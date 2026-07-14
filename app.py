"""
╔══════════════════════════════════════════════════════════════════════════════════╗
║          KrishiBot – AI-Powered Smart Farming Advice Agent                     ║
║          Built with Flask + IBM watsonx.ai (Granite models) + RAG              ║
║          Version: 1.0.0  |  Language: Python 3.10+                             ║
╚══════════════════════════════════════════════════════════════════════════════════╝
"""

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 1: AGENT INSTRUCTIONS
#  Modify this section to change KrishiBot's personality, behavior, and style.
# ─────────────────────────────────────────────────────────────────────────────

AGENT_INSTRUCTIONS = {
    # Core identity of the agent
    "name": "KrishiBot",
    "role": "Expert AI Agricultural Advisor for Indian Farmers",
    "persona": (
        "You are KrishiBot, a knowledgeable, empathetic, and practical AI farming assistant "
        "designed specifically for Indian farmers. You have deep expertise in Indian agriculture, "
        "crops, soil science, pest management, irrigation, government schemes, and market prices. "
        "You speak in a warm, respectful, and encouraging tone, as a trusted advisor would. "
        "You always prioritize sustainable farming practices and farmer welfare."
    ),

    # Response style guidelines
    "response_style": {
        "format": "structured",            # "structured" | "conversational"
        "use_bullet_points": True,
        "include_quantities": True,
        "cite_sources": True,
        "max_response_length": "medium",   # "short" | "medium" | "long"
        "local_language_terms": True,
        "include_cost_info": True,
        "government_scheme_reminder": True
    },

    # Safety and content rules
    "safety_rules": [
        "Never recommend banned or restricted pesticides (Endosulfan, Monocrotophos, etc.)",
        "Always mention PPE (Personal Protective Equipment) when discussing pesticides",
        "Encourage soil testing before fertilizer recommendations",
        "Prefer biological and cultural control methods before chemical recommendations",
        "Always advise consulting local KVK or Agriculture Department for location-specific guidance",
        "Do not make financial promises about crop yields or income",
        "Warn about risks of adulterated pesticides and seeds – buy from licensed dealers only"
    ],

    # Supported interaction languages
    "supported_languages": {
        "primary": "English",
        "secondary": ["Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Punjabi", "Bengali", "Gujarati"],
        "auto_detect": True,
        "instruction": "If the user writes in Hindi or a regional language, respond in the same language mixing English technical terms as needed."
    },

    # Crop specialization (adjust to your target region)
    "crop_focus": [
        "Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Soybean",
        "Groundnut", "Tomato", "Potato", "Onion", "Pulses", "Vegetables", "Fruits"
    ],

    # System prompt template (used for watsonx.ai calls)
    "system_prompt_template": """You are {name}, {role}.

{persona}

KNOWLEDGE CONTEXT (from agricultural knowledge base):
{context}

RESPONSE GUIDELINES:
- Provide accurate, practical, and actionable advice based on the knowledge context above
- Structure responses clearly with headings and bullet points
- Include specific quantities, dosages, timings, and costs when relevant
- Mention applicable government schemes (PM-KISAN, PMFBY, PMKSY etc.) when relevant
- For pest/disease queries, follow IPM principles (cultural → biological → chemical)
- Always add a safety note when recommending pesticides
- If information is not in context, use your agricultural knowledge but acknowledge it
- Keep responses focused and practical – farmers need actionable advice
- Use simple language; avoid jargon without explanation

SAFETY RULES:
{safety_rules}

Current conversation history:
{chat_history}

Farmer's Question: {user_question}

Provide a helpful, accurate, and practical response:"""
}

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 2: KNOWLEDGE CONFIG
#  Modify to adjust RAG retrieval and knowledge source settings.
# ─────────────────────────────────────────────────────────────────────────────

KNOWLEDGE_CONFIG = {
    # Knowledge base files (relative to knowledge_base/ directory)
    "knowledge_files": {
        "crops":        "knowledge_base/crops.json",
        "soil_health":  "knowledge_base/soil_health.json",
        "pest_disease": "knowledge_base/pest_disease.json",
        "fertilizers":  "knowledge_base/fertilizers.json",
        "irrigation":   "knowledge_base/irrigation.json",
        "schemes":      "knowledge_base/schemes_market.json",
    },

    # RAG retrieval settings
    "retrieval": {
        "chunk_size": 512,
        "chunk_overlap": 64,
        "top_k": 5,
        "similarity_threshold": 0.2,
        "rerank": True,
        "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
    },

    # Topic → knowledge file mapping for efficient retrieval
    "topic_routing": {
        "crop":         ["crops", "soil_health", "irrigation"],
        "seed":         ["crops"],
        "soil":         ["soil_health", "fertilizers"],
        "pest":         ["pest_disease"],
        "insect":       ["pest_disease"],
        "disease":      ["pest_disease"],
        "fertilizer":   ["fertilizers", "soil_health"],
        "nutrient":     ["fertilizers", "soil_health"],
        "irrigation":   ["irrigation"],
        "water":        ["irrigation"],
        "scheme":       ["schemes"],
        "subsidy":      ["schemes"],
        "market":       ["schemes"],
        "price":        ["schemes"],
        "organic":      ["fertilizers", "schemes"],
        "weather":      ["crops", "irrigation"],
    },

    # Trusted external knowledge sources (informational – not live-fetched)
    "trusted_sources": [
        "ICAR (Indian Council of Agricultural Research) – icar.org.in",
        "IARI (Indian Agricultural Research Institute) – iari.res.in",
        "Ministry of Agriculture & Farmers Welfare – agricoop.gov.in",
        "Agmarknet – agmarknet.gov.in",
        "eNAM – enam.gov.in",
        "Kisan Call Centre – 1800-180-1551",
        "State KVK (Krishi Vigyan Kendra) network",
        "NRAA, CRIDA, NBSS&LUP (soil science)",
        "State Agriculture University publications"
    ]
}

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 3: IBM WATSONX.AI MODEL CONFIG
# ─────────────────────────────────────────────────────────────────────────────

WATSONX_CONFIG = {
    # Primary model confirmed working on this project (eu-gb region).
    # The initialize() method auto-discovers supported models and tries
    # each candidate in order, so this always picks the best available one.
    "model_id": "meta-llama/llama-3-3-70b-instruct",
    "fallback_model_id": "mistralai/mistral-small-3-1-24b-instruct-2503",
    "parameters": {
        "max_new_tokens": 1024,
        "min_new_tokens": 50,
        "stop_sequences": ["<|endoftext|>", "Farmer's Question:"],
        "repetition_penalty": 1.1,
        "temperature": 0.7,
    }
}

# =============================================================================
#  IMPORTS & SETUP
# =============================================================================

import os
import json
import logging
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import requests
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv

# watsonx.ai SDK
try:
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    WATSONX_AVAILABLE = True
except ImportError:
    WATSONX_AVAILABLE = False
    logging.warning("ibm-watsonx-ai not installed. Running in demo mode.")

# Sentence-transformers for embeddings (RAG)
try:
    from sentence_transformers import SentenceTransformer
    import faiss
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logging.warning("sentence-transformers/faiss not installed. RAG disabled.")

# ─── Load environment variables ───────────────────────────────────────────────
# Priority: .env  →  .env.example  →  system environment
# This means the app works even when the git-ignored .env was not created yet –
# the user can simply put their credentials in .env.example and it will be read.
if Path(".env").exists():
    load_dotenv(dotenv_path=".env", override=True)
    _env_source = ".env"
elif Path(".env.example").exists():
    load_dotenv(dotenv_path=".env.example", override=True)
    _env_source = ".env.example"
else:
    _env_source = "system environment only"

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("KrishiBot")
logger.info(f"Environment loaded from : {_env_source}")
logger.info(f"IBM_API_KEY present     : {bool(os.getenv('IBM_API_KEY', '').strip())}")
logger.info(f"IBM_PROJECT_ID present  : {bool(os.getenv('IBM_PROJECT_ID', '').strip())}")

# ─── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "krishibot-dev-secret-2024")
CORS(app)

# =============================================================================
#  RAG ENGINE
# =============================================================================

class KrishiBotRAG:
    """Lightweight RAG engine using local JSON knowledge base + FAISS vector index."""

    def __init__(self):
        self.chunks: list = []       # list of {"text": str, "source": str, "hash": str}
        self.index = None            # FAISS index
        self.embedder = None
        self._initialized = False
        self._init_lock = False

    def initialize(self):
        """Load knowledge base and build vector index."""
        if self._initialized or self._init_lock:
            return
        self._init_lock = True
        logger.info("Initializing KrishiBot RAG engine …")

        try:
            # Load knowledge files
            for key, path in KNOWLEDGE_CONFIG["knowledge_files"].items():
                if Path(path).exists():
                    try:
                        self._load_json_knowledge(path, key)
                        logger.info(f"  Loaded {key}: {path}")
                    except Exception as e:
                        logger.error(f"  Failed to load {key} ({path}): {e}")
                else:
                    logger.warning(f"  Knowledge file not found: {path}")

            logger.info(f"  Total chunks: {len(self.chunks)}")

            # Build embeddings & FAISS index
            if RAG_AVAILABLE and self.chunks:
                try:
                    embedding_model = KNOWLEDGE_CONFIG["retrieval"]["embedding_model"]
                    logger.info(f"  Loading embedding model: {embedding_model}")
                    self.embedder = SentenceTransformer(embedding_model)
                    texts = [c["text"] for c in self.chunks]
                    logger.info("  Computing embeddings (first run may take a moment)…")
                    embeddings = self.embedder.encode(
                        texts, show_progress_bar=False,
                        batch_size=32, convert_to_numpy=True
                    )
                    embeddings = embeddings.astype("float32")
                    dim = embeddings.shape[1]
                    self.index = faiss.IndexFlatL2(dim)
                    self.index.add(embeddings)
                    logger.info(f"  FAISS index built: {self.index.ntotal} vectors (dim={dim})")
                except Exception as e:
                    logger.error(f"  Embedding build failed, using keyword fallback: {e}")
                    self.embedder = None
                    self.index = None
            else:
                logger.warning("  RAG vector search unavailable – using keyword fallback.")

            self._initialized = True
            logger.info("RAG engine ready.")
        finally:
            self._init_lock = False

    def _load_json_knowledge(self, filepath: str, source_key: str):
        """Flatten JSON knowledge into text chunks."""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        flat_text = self._flatten_json(data)
        chunk_size = KNOWLEDGE_CONFIG["retrieval"]["chunk_size"]
        overlap    = KNOWLEDGE_CONFIG["retrieval"]["chunk_overlap"]

        for i in range(0, len(flat_text), chunk_size - overlap):
            chunk_text = flat_text[i:i + chunk_size].strip()
            if len(chunk_text) < 50:
                continue
            self.chunks.append({
                "text":   chunk_text,
                "source": source_key,
                "hash":   hashlib.md5(chunk_text.encode()).hexdigest()[:8]
            })

    def _flatten_json(self, obj, prefix="") -> str:
        """Recursively flatten JSON into readable text."""
        parts = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                parts.append(self._flatten_json(v, prefix=f"{k}: "))
        elif isinstance(obj, list):
            for item in obj:
                parts.append(self._flatten_json(item, prefix=prefix))
        else:
            parts.append(f"{prefix}{obj}")
        return "\n".join(parts)

    def retrieve(self, query: str, topic: Optional[str] = None) -> str:
        """Retrieve relevant context for a query."""
        if not self._initialized:
            self.initialize()

        top_k = KNOWLEDGE_CONFIG["retrieval"]["top_k"]

        # Topic-based routing
        allowed_sources = None
        if topic:
            for keyword, sources in KNOWLEDGE_CONFIG["topic_routing"].items():
                if keyword in topic.lower():
                    allowed_sources = sources
                    break

        if self.index is not None and self.embedder and self.chunks:
            return self._vector_retrieve(query, top_k, allowed_sources)
        return self._keyword_retrieve(query, top_k, allowed_sources)

    def _vector_retrieve(self, query: str, top_k: int,
                         allowed_sources: Optional[list]) -> str:
        """FAISS-based semantic retrieval."""
        query_vec = self.embedder.encode(
            [query], convert_to_numpy=True
        ).astype("float32")
        search_k = min(top_k * 4, len(self.chunks))
        distances, indices = self.index.search(query_vec, search_k)

        results = []
        seen = set()
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.chunks):
                continue
            chunk = self.chunks[idx]
            if allowed_sources and chunk["source"] not in allowed_sources:
                continue
            if chunk["hash"] in seen:
                continue
            seen.add(chunk["hash"])
            results.append((dist, chunk["text"], chunk["source"]))
            if len(results) >= top_k:
                break

        # Fallback: ignore source filter if nothing found
        if not results:
            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or idx >= len(self.chunks):
                    continue
                chunk = self.chunks[idx]
                if chunk["hash"] in seen:
                    continue
                seen.add(chunk["hash"])
                results.append((dist, chunk["text"], chunk["source"]))
                if len(results) >= top_k:
                    break

        return "\n\n---\n\n".join(
            f"[Source: {src.upper()}]\n{text}" for _, text, src in results
        )

    def _keyword_retrieve(self, query: str, top_k: int,
                          allowed_sources: Optional[list]) -> str:
        """Simple keyword-based fallback retrieval."""
        query_words = set(re.findall(r"\b\w+\b", query.lower()))
        scored = []
        for chunk in self.chunks:
            if allowed_sources and chunk["source"] not in allowed_sources:
                continue
            chunk_words = set(re.findall(r"\b\w+\b", chunk["text"].lower()))
            score = len(query_words & chunk_words)
            if score > 0:
                scored.append((score, chunk["text"], chunk["source"]))

        scored.sort(key=lambda x: -x[0])
        results = scored[:top_k]
        if not results:
            results = [(0, c["text"], c["source"]) for c in self.chunks[:top_k]]

        return "\n\n---\n\n".join(
            f"[Source: {src.upper()}]\n{text}" for _, text, src in results
        )


# ─── Singleton RAG instance ───────────────────────────────────────────────────
rag_engine = KrishiBotRAG()


# =============================================================================
#  WATSONX.AI CLIENT
# =============================================================================

class WatsonxClient:
    """Wrapper for IBM watsonx.ai ModelInference."""

    def __init__(self):
        self._model             = None
        self._ready             = False
        self._error: Optional[str] = None
        # Credentials are read lazily inside initialize() – after load_dotenv()
        # has already run – so leading/trailing spaces are stripped and the
        # correct file (.env or .env.example) is always honoured.
        self._api_key:          Optional[str] = None
        self._project_id:       Optional[str] = None
        self._url:              Optional[str] = None
        self._active_model_id:  Optional[str] = None

    # ------------------------------------------------------------------
    def _load_credentials(self):
        """Read (or re-read) credentials from the current environment."""
        self._api_key    = (os.getenv("IBM_API_KEY",    "")).strip()
        self._project_id = (os.getenv("IBM_PROJECT_ID", "")).strip()
        raw_url          = (os.getenv("IBM_WATSONX_URL",
                                      "https://us-south.ml.cloud.ibm.com")).strip()

        # Auto-correct common URL mistakes:
        # Users sometimes paste the Cloud Pak for Data / dataplatform URL.
        # The watsonx.ai SaaS REST endpoint must use *.ml.cloud.ibm.com
        # e.g.  https://eu-gb.dataplatform.cloud.ibm.com
        #    →  https://eu-gb.ml.cloud.ibm.com
        if "dataplatform.cloud.ibm.com" in raw_url:
            region = raw_url.split("//")[-1].split(".")[0]   # e.g. "eu-gb"
            raw_url = f"https://{region}.ml.cloud.ibm.com"
            logger.warning(
                f"IBM_WATSONX_URL contained a dataplatform URL – "
                f"auto-corrected to: {raw_url}"
            )
        self._url = raw_url

    # ------------------------------------------------------------------
    def initialize(self):
        """Connect to watsonx.ai.  Safe to call multiple times."""
        if self._ready:
            return

        if not WATSONX_AVAILABLE:
            self._error = ("ibm-watsonx-ai package not installed. "
                           "Run: pip install ibm-watsonx-ai")
            logger.warning(self._error)
            return

        self._load_credentials()

        # Reject empty / placeholder values
        _placeholders = {"", "your_ibm_cloud_api_key_here", "your_api_key_here",
                         "PASTE_YOUR_IBM_CLOUD_API_KEY_HERE"}
        if self._api_key in _placeholders:
            self._error = ("IBM_API_KEY is empty or still has the placeholder value. "
                           "Add your real key to .env or .env.example.")
            logger.warning(self._error)
            return
        if self._project_id in _placeholders:
            self._error = ("IBM_PROJECT_ID is empty or still has the placeholder value. "
                           "Add your real project ID to .env or .env.example.")
            logger.warning(self._error)
            return

        logger.info(f"Connecting to watsonx.ai  url={self._url}")
        logger.info(f"  project_id = '{self._project_id}'")
        logger.info(f"  api_key    = '{self._api_key[:8]}…'")

        # Build credentials and client once
        try:
            credentials = Credentials(api_key=self._api_key, url=self._url)
            client      = APIClient(credentials=credentials,
                                    project_id=self._project_id)
        except Exception as e:
            self._error = f"APIClient init failed: {e}"
            logger.error(self._error)
            return

        # Discover which instruct models this project actually supports,
        # then try each candidate in preference order.
        try:
            supported = [
                m.get("model_id", "")
                for m in client.foundation_models.get_model_specs().get("resources", [])
            ]
            logger.info(f"  Supported models in this project: {supported}")
        except Exception:
            supported = []   # can't list – try anyway

        # Preference order: configured primary/fallback first, then well-known instruct models
        candidates = [
            WATSONX_CONFIG["model_id"],
            WATSONX_CONFIG.get("fallback_model_id", ""),
            "ibm/granite-3-8b-instruct",
            "ibm/granite-3-1-8b-instruct",
            "ibm/granite-4-h-small",
            "meta-llama/llama-3-3-70b-instruct",
            "meta-llama/llama-3-1-8b",
            "mistralai/mistral-small-3-1-24b-instruct-2503",
            "mistral-large-2512",
        ]
        # Put models confirmed in supported list first
        ordered = ([m for m in candidates if m in supported] +
                   [m for m in candidates if m not in supported and m])

        last_err = None
        for model_id in dict.fromkeys(ordered):   # deduplicate, preserve order
            try:
                self._model = ModelInference(
                    model_id=model_id,
                    api_client=client,
                    params=WATSONX_CONFIG["parameters"]
                )
                # Quick ping – generate 1 token to confirm it actually works
                self._model.generate_text(
                    prompt="Hi",
                    params={"decoding_method": "greedy",
                            "max_new_tokens": 1, "min_new_tokens": 1}
                )
                self._ready           = True
                self._active_model_id = model_id
                logger.info(f"watsonx.ai connected – model: {model_id}")
                return
            except Exception as e:
                last_err = e
                logger.warning(f"  Model '{model_id}' failed: {e}")

        self._error = str(last_err)
        logger.error(f"watsonx.ai init failed for all models. Last error: {last_err}")

    # ------------------------------------------------------------------
    def generate(self, prompt: str) -> dict:
        """Generate text.  Falls back to demo mode if watsonx.ai is unavailable."""
        if not self._ready:
            self.initialize()

        if self._ready and self._model:
            try:
                response = self._model.generate_text(prompt=prompt)
                text = response.strip() if isinstance(response, str) else str(response)
                return {
                    "text":  text,
                    "model": self._active_model_id or WATSONX_CONFIG["model_id"],
                    "demo":  False,
                    "error": None,
                }
            except Exception as e:
                logger.error(f"watsonx.ai generate error: {e}")
                self._error = str(e)

        return self._demo_response(prompt)

    # ------------------------------------------------------------------
    def _demo_response(self, prompt: str) -> dict:
        """Meaningful demo reply when watsonx.ai is unavailable."""
        q_match  = re.search(r"Farmer's Question:\s*(.+?)(?:\n|$)", prompt, re.DOTALL)
        question = q_match.group(1).strip() if q_match else "your question"

        demo_text = (
            f"🌾 **KrishiBot Demo Response**\n\n"
            f"*(Note: This is a demo response. Connect IBM watsonx.ai API for full AI-powered answers.)*\n\n"
            f"Thank you for your question: **\"{question[:100]}\"**\n\n"
            f"I'm KrishiBot, your AI farming assistant. To get personalised, AI-powered advice:\n\n"
            f"**Setup Steps:**\n"
            f"1. Get your free IBM Cloud account at cloud.ibm.com\n"
            f"2. Create a Watson Machine Learning service\n"
            f"3. Create a watsonx.ai project and note your Project ID\n"
            f"4. Generate an API key in IBM Cloud IAM\n"
            f"5. Add `IBM_API_KEY` and `IBM_PROJECT_ID` to your `.env.example` file\n\n"
            f"**Diagnostic:** Visit http://localhost:5000/api/debug to see exactly what is loaded.\n\n"
            f"**In the meantime, visit:**\n"
            f"• Kisan Call Centre: **1800-180-1551** (toll-free)\n"
            f"• KVK (Krishi Vigyan Kendra) in your district\n"
            f"• ICAR website: icar.org.in\n\n"
            f"*Jai Kisan! 🚜*"
        )
        return {
            "text":  demo_text,
            "model": "demo-mode",
            "demo":  True,
            "error": self._error,
        }

    # ------------------------------------------------------------------
    @property
    def is_ready(self):
        return self._ready

    @property
    def status_info(self):
        return {
            "ready":      self._ready,
            "model":      self._active_model_id if self._ready else None,
            "demo_mode":  not self._ready,
            "error":      self._error,
        }


# ─── Singleton client ─────────────────────────────────────────────────────────
wx_client = WatsonxClient()


# =============================================================================
#  PROMPT BUILDER
# =============================================================================

def build_prompt(user_question: str, context: str, chat_history: list) -> str:
    """Build the full prompt for watsonx.ai."""
    history_text = ""
    for msg in chat_history[-6:]:   # last 3 exchanges
        role = "Farmer" if msg["role"] == "user" else "KrishiBot"
        history_text += f"{role}: {msg['content'][:200]}\n"

    safety_rules_text = "\n".join(
        f"• {rule}" for rule in AGENT_INSTRUCTIONS["safety_rules"]
    )

    return AGENT_INSTRUCTIONS["system_prompt_template"].format(
        name=AGENT_INSTRUCTIONS["name"],
        role=AGENT_INSTRUCTIONS["role"],
        persona=AGENT_INSTRUCTIONS["persona"],
        context=(context if context
                 else "No specific knowledge base context available – use general agricultural knowledge."),
        safety_rules=safety_rules_text,
        chat_history=(history_text if history_text else "No previous conversation."),
        user_question=user_question,
    )


# =============================================================================
#  WEATHER SERVICE
# =============================================================================

def get_weather(city: str) -> dict:
    """Fetch weather data from OpenWeatherMap API."""
    api_key = os.getenv("WEATHER_API_KEY", "")
    if not api_key or api_key == "your_openweathermap_api_key_here":
        return _demo_weather(city)
    try:
        url = (f"https://api.openweathermap.org/data/2.5/weather"
               f"?q={city}&appid={api_key}&units=metric")
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return {
                "city":          city,
                "temperature":   data["main"]["temp"],
                "feels_like":    data["main"]["feels_like"],
                "humidity":      data["main"]["humidity"],
                "description":   data["weather"][0]["description"].capitalize(),
                "wind_speed":    data["wind"]["speed"],
                "pressure":      data["main"]["pressure"],
                "icon":          data["weather"][0]["icon"],
                "demo":          False,
                "farming_alert": _weather_farming_alert(data),
            }
    except Exception as e:
        logger.warning(f"Weather API error: {e}")
    return _demo_weather(city)


def _weather_farming_alert(data: dict) -> str:
    temp     = data["main"]["temp"]
    humidity = data["main"]["humidity"]
    desc     = data["weather"][0]["main"].lower()
    alerts   = []

    if temp > 40:
        alerts.append("⚠️ Extreme heat: Irrigate in early morning or evening. Watch for heat stress in standing crops.")
    elif temp < 5:
        alerts.append("⚠️ Cold wave: Protect nurseries and winter vegetables. Smoke/smudge pots for frost protection.")

    if humidity > 85 and "rain" not in desc:
        alerts.append("⚠️ High humidity: Risk of fungal diseases (blight, mildew, rust). Ensure proper field drainage.")

    if "rain" in desc or "storm" in desc:
        alerts.append("🌧️ Rain expected: Delay spraying operations. Ensure drainage channels are clear.")

    if not alerts:
        alerts.append("✅ Weather conditions are generally favourable for field operations.")

    return " | ".join(alerts)


def _demo_weather(city: str) -> dict:
    return {
        "city":          city or "India",
        "temperature":   28.5,
        "feels_like":    30.0,
        "humidity":      65,
        "description":   "Partly Cloudy",
        "wind_speed":    12.5,
        "pressure":      1013,
        "icon":          "02d",
        "demo":          True,
        "farming_alert": "✅ Configure WEATHER_API_KEY in .env for real-time weather. Demo data shown.",
    }


# =============================================================================
#  CROP RECOMMENDATION ENGINE
# =============================================================================

def get_crop_recommendations(season: str, soil_type: str, state: str) -> list:
    """Return crop recommendations based on season, soil type, and state."""
    try:
        with open(KNOWLEDGE_CONFIG["knowledge_files"]["crops"], "r", encoding="utf-8") as f:
            data = json.load(f)

        recommendations = []
        for crop in data.get("crops", []):
            score   = 0
            reasons = []

            if season and any(s.lower() in season.lower() for s in crop.get("season", [])):
                score += 3
                reasons.append(f"Suitable for {season} season")

            if soil_type and any(soil_type.lower() in s.lower()
                                 for s in crop.get("soil_types", [])):
                score += 2
                reasons.append(f"Grows well in {soil_type} soil")

            if state and any(state.lower() in st.lower()
                             for st in crop.get("states", [])):
                score += 2
                reasons.append(f"Major crop in {state}")

            if score > 0:
                recommendations.append({
                    "name":    crop["name"],
                    "hindi":   crop.get("hindi", ""),
                    "season":  crop.get("season", []),
                    "yield":   crop.get("yield_potential", "N/A"),
                    "water":   crop.get("water_requirement", "N/A"),
                    "score":   score,
                    "reasons": reasons,
                    "tips":    crop.get("tips", ""),
                })

        recommendations.sort(key=lambda x: -x["score"])
        return recommendations[:6]
    except Exception as e:
        logger.error(f"Crop recommendation error: {e}")
        return []


# =============================================================================
#  FLASK ROUTES
# =============================================================================

@app.before_request
def init_on_first_request():
    """Lazily initialise RAG engine on the very first request."""
    if not rag_engine._initialized:
        try:
            rag_engine.initialize()
        except Exception as e:
            logger.error(f"RAG init error: {e}")


@app.route("/")
def index():
    return render_template("index.html",
                           app_name=AGENT_INSTRUCTIONS["name"],
                           version=os.getenv("APP_VERSION", "1.0.0"))


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint – receives question, runs RAG, calls Granite, returns reply."""
    data         = request.get_json(force=True)
    user_message = data.get("message", "").strip()
    language     = data.get("language", "en")

    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    if "chat_history" not in session:
        session["chat_history"] = []
    chat_history = session["chat_history"]

    # RAG retrieval
    context = rag_engine.retrieve(user_message, topic=user_message.lower())

    # Build prompt
    prompt = build_prompt(user_message, context, chat_history)
    if language != "en":
        lang_map = {
            "hi": "Hindi", "te": "Telugu", "ta": "Tamil",
            "kn": "Kannada", "mr": "Marathi", "pa": "Punjabi",
            "bn": "Bengali", "gu": "Gujarati",
        }
        prompt += f"\n\n[Please respond in {lang_map.get(language, 'the requested language')}]"

    # Call watsonx.ai
    result = wx_client.generate(prompt)

    # Update session history
    chat_history.append({"role": "user",      "content": user_message})
    chat_history.append({"role": "assistant", "content": result["text"]})
    max_hist = int(os.getenv("MAX_CHAT_HISTORY", 20))
    session["chat_history"] = chat_history[-max_hist:]

    return jsonify({
        "response":       result["text"],
        "model":          result["model"],
        "demo_mode":      result.get("demo", False),
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "context_sources": list({c["source"] for c in rag_engine.chunks[:5]})
                           if rag_engine.chunks else [],
    })


@app.route("/api/weather", methods=["GET"])
def weather():
    city = request.args.get("city", os.getenv("DEFAULT_CITY", "New Delhi"))
    return jsonify(get_weather(city))


@app.route("/api/crop-recommendations", methods=["POST"])
def crop_recommendations():
    data = request.get_json(force=True)
    recs = get_crop_recommendations(
        data.get("season", ""),
        data.get("soil_type", ""),
        data.get("state", ""),
    )
    return jsonify({"recommendations": recs, "count": len(recs)})


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status":            "running",
        "app":               AGENT_INSTRUCTIONS["name"],
        "version":           os.getenv("APP_VERSION", "1.0.0"),
        "rag_ready":         rag_engine._initialized,
        "rag_chunks":        len(rag_engine.chunks),
        "watsonx":           wx_client.status_info,
        "knowledge_sources": list(KNOWLEDGE_CONFIG["knowledge_files"].keys()),
        "timestamp":         datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/clear-history", methods=["POST"])
def clear_history():
    session.pop("chat_history", None)
    return jsonify({"status": "cleared"})


@app.route("/api/quick-queries", methods=["GET"])
def quick_queries():
    queries = [
        {"icon": "🌾", "text": "Best crops for this season in Punjab?",                         "category": "crop"},
        {"icon": "🪲", "text": "Fall Armyworm attack on my maize crop – what to do?",            "category": "pest"},
        {"icon": "💧", "text": "How to set up drip irrigation for tomatoes?",                    "category": "irrigation"},
        {"icon": "🌱", "text": "Soil health card recommendations – how to improve black soil?",  "category": "soil"},
        {"icon": "💊", "text": "Fertilizer schedule for wheat in north India",                   "category": "fertilizer"},
        {"icon": "💰", "text": "What is MSP for paddy and how to sell to government?",           "category": "market"},
        {"icon": "🏛️", "text": "PM-KISAN registration – how to apply?",                         "category": "scheme"},
        {"icon": "🌿", "text": "How to start organic farming and get certification?",            "category": "organic"},
        {"icon": "🌡️", "text": "Weather alert for my crops – what precautions to take?",        "category": "weather"},
        {"icon": "🐄", "text": "Integrated farming – combine crops and livestock profitably",    "category": "general"},
    ]
    return jsonify({"queries": queries})


@app.route("/api/market-prices", methods=["GET"])
def market_prices():
    try:
        with open(KNOWLEDGE_CONFIG["knowledge_files"]["schemes"], "r", encoding="utf-8") as f:
            data = json.load(f)
        market = data.get("market_information", {})
        return jsonify({
            "msp_kharif":      market.get("msp_2024_kharif", {}),
            "msp_rabi":        market.get("msp_2024_rabi", {}),
            "selling_channels": market.get("selling_channels", []),
            "price_sources":   market.get("price_information_sources", []),
            "note": "MSP prices as per Government of India notification for 2024-25 season.",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schemes", methods=["GET"])
def government_schemes():
    try:
        with open(KNOWLEDGE_CONFIG["knowledge_files"]["schemes"], "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify({"schemes": data.get("government_schemes", [])})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/debug", methods=["GET"])
def debug_info():
    """Diagnostic endpoint – shows masked credentials and current connection state."""
    api_key_raw = os.getenv("IBM_API_KEY", "")
    proj_id_raw = os.getenv("IBM_PROJECT_ID", "")
    if len(api_key_raw) > 12:
        api_key_disp = api_key_raw[:8] + "…" + api_key_raw[-4:]
    elif api_key_raw:
        api_key_disp = api_key_raw
    else:
        api_key_disp = "[empty]"

    return jsonify({
        "env_source":        _env_source,
        "IBM_API_KEY":       api_key_disp,
        "IBM_PROJECT_ID":    proj_id_raw.strip() or "[empty]",
        "IBM_WATSONX_URL":   os.getenv("IBM_WATSONX_URL", "[not set]"),
        "watsonx_ready":     wx_client._ready,
        "watsonx_error":     wx_client._error,
        "active_model":      wx_client._active_model_id,
        "watsonx_available": WATSONX_AVAILABLE,
        "rag_chunks":        len(rag_engine.chunks),
    })


@app.route("/api/re-init", methods=["POST"])
def re_init():
    """Force re-connect to watsonx.ai without restarting the server."""
    wx_client._ready  = False
    wx_client._error  = None
    wx_client._model  = None
    # Re-load env so an updated .env.example is picked up immediately
    if Path(".env").exists():
        load_dotenv(dotenv_path=".env", override=True)
    elif Path(".env.example").exists():
        load_dotenv(dotenv_path=".env.example", override=True)
    wx_client.initialize()
    return jsonify(wx_client.status_info)


# =============================================================================
#  MAIN
# =============================================================================

if __name__ == "__main__":
    logger.info("━" * 60)
    logger.info(f"  Starting {AGENT_INSTRUCTIONS['name']} v{os.getenv('APP_VERSION', '1.0.0')}")
    logger.info("━" * 60)

    rag_engine.initialize()
    wx_client.initialize()

    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    logger.info(f"Server starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
