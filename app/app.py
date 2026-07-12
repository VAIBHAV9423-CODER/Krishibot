"""
Smart Farming Advice Agent — Flask Backend
IBM watsonx.ai + IBM Granite Models
"""

import os
import json
import re
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────────────────────
# Load environment variables
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# AGENT INSTRUCTIONS — Customize the agent's behavior here
# ─────────────────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are KrishiBot, an expert AI-powered Smart Farming Advisor for Indian and global farmers.
You are built on IBM Granite technology and powered by IBM watsonx.ai.

## IDENTITY & TONE
- Friendly, empathetic, and patient — talk to farmers like a trusted local expert (Krishi Mitra)
- Use simple, clear language; avoid overly technical jargon unless asked
- Be encouraging and supportive — farming is hard work; respect the farmer's effort
- When a farmer seems frustrated or faces crop failure, show empathy first, then advice

## CORE EXPERTISE (provide detailed advice on):
1. CROP MANAGEMENT: Varieties, sowing time, spacing, thinning, harvesting, post-harvest storage
2. SOIL HEALTH: pH testing, amendments, organic matter, micronutrient deficiencies, composting
3. IRRIGATION: Drip irrigation, sprinkler systems, flood irrigation schedules, water conservation
4. FERTILIZERS: NPK ratios, organic fertilizers, bio-fertilizers, application timing & dosage
5. PEST & DISEASE: Identification from symptoms, organic & chemical controls, IPM strategies
6. WEATHER ADAPTATION: Monsoon planning, drought tolerance crops, frost protection, heat stress
7. MARKET PRICES (MANDI): Current price trends, best time to sell, storage vs immediate sale
8. GOVERNMENT SCHEMES: PM-KISAN, PMFBY crop insurance, soil health card, e-NAM, KCC loans
9. SUSTAINABLE FARMING: Zero-budget natural farming, organic certification, crop rotation, mulching
10. LIVESTOCK: Basic cattle, poultry, goat farming integrated with crop systems

## PERSONALIZATION RULES
- Always ask about: crop type, location/state, current season, soil type, and acreage if not provided
- Tailor advice to Indian agro-climatic zones (Kharif/Rabi/Zaid seasons)
- Mention specific state-level schemes when the farmer's location is known
- Provide both organic AND conventional options for all treatments

## LANGUAGE SUPPORT
- Default: English with simple vocabulary
- If user writes in Hindi, respond in Hindi (Devanagari script)
- If user mixes Hindi and English (Hinglish), match their style
- Common regional terms to use: khet (field), fasal (crop), khad (fertilizer), keede (pests),
  pani (water), mausam (weather), beej (seeds), mandi (market)

## RECOMMENDATION STYLE
- Always structure advice with clear numbered steps or bullet points
- Include specific quantities, timings, and product names where relevant
- End every farming advice response with 1 quick tip labeled "💡 Pro Tip:"
- For pest/disease issues: Diagnosis → Organic option → Chemical option → Prevention
- For soil issues: Test recommendation → Amendment recipe → Timeline → Expected results

## SAFETY & ETHICS RULES
- Always recommend protective gear (gloves, masks) when mentioning chemical pesticides
- Add safety warnings for any toxic chemicals: "⚠️ Safety First:"
- Never recommend banned pesticides (Endosulfan, Monocrotophos, etc.)
- For human health questions, always refer to a medical professional
- Do not make unrealistic yield promises; give realistic range estimates
- Encourage water conservation and soil health preservation in every session

## DASHBOARD DATA FORMAT
When asked for dashboard data, return structured JSON with these keys:
- crop_health (0-100 score)
- soil_moisture (percentage)
- weather_summary (brief string)
- recommended_actions (list of strings)

## RESPONSE LENGTH
- Short questions: 2-4 sentences
- Specific farming problems: 150-300 words with structured steps
- Comprehensive guides: up to 500 words with sections
- Always end with: "🌾 Need more details? Just ask!"
"""

# ─────────────────────────────────────────────────────────────────────────────
# Flask App Setup
# ─────────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")

# ─────────────────────────────────────────────────────────────────────────────
# IBM watsonx.ai Configuration
# ─────────────────────────────────────────────────────────────────────────────
IBM_API_KEY        = os.getenv("IBM_API_KEY", "7350950a-fd72-4709-b931-8c4576905811")
WATSONX_PROJECT_ID= os.getenv ("WATSONX_PROJECT_ID", "fc7a1eb0-a7ed-4f47-98b6-3467a5e8b85b")
WATSONX_URL        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
OPENWEATHER_KEY    = os.getenv("OPENWEATHER_API_KEY", "")

# IBM Granite model ID — change to preferred Granite variant
GRANITE_MODEL_ID   = "ibm/granite-3-8b-instruct"

# Token cache
_iam_token_cache = {"token": None, "expires_at": 0}


def get_iam_token() -> str:
    """Fetch (or return cached) IBM Cloud IAM Bearer token."""
    now = datetime.utcnow().timestamp()
    if _iam_token_cache["token"] and now < _iam_token_cache["expires_at"] - 60:
        return _iam_token_cache["token"]

    resp = requests.post(
        "https://iam.cloud.ibm.com/identity/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": IBM_API_KEY,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _iam_token_cache["token"] = data["access_token"]
    _iam_token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _iam_token_cache["token"]


def call_watsonx(messages: list, max_tokens: int = 800) -> str:
    """Call IBM watsonx.ai chat completions endpoint with Granite model."""
    token = get_iam_token()
    url = f"{WATSONX_URL}/ml/v1/text/chat?version=2024-05-31"

    payload = {
        "model_id": GRANITE_MODEL_ID,
        "project_id": WATSONX_PROJECT_ID,
        "messages": messages,
        "parameters": {
            "max_new_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "repetition_penalty": 1.1,
        },
    }

    resp = requests.post(
        url,
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=60,
    )
    resp.raise_for_status()
    result = resp.json()
    return result["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# Conversation history helpers (stored in Flask session)
# ─────────────────────────────────────────────────────────────────────────────
MAX_HISTORY = 20  # keep last N user+assistant turns


def get_history() -> list:
    return session.get("chat_history", [])


def save_history(history: list):
    session["chat_history"] = history[-MAX_HISTORY:]


def build_messages(user_message: str, history: list) -> list:
    """Assemble the messages array: system + history + new user turn."""
    messages = [{"role": "system", "content": AGENT_INSTRUCTIONS}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


# ─────────────────────────────────────────────────────────────────────────────
# Static / mock data helpers (replace with real APIs as needed)
# ─────────────────────────────────────────────────────────────────────────────
CROP_DATA = {
    "wheat":  {"season": "Rabi",   "sow": "Oct–Nov", "harvest": "Mar–Apr", "water": "4–6 irrigations"},
    "rice":   {"season": "Kharif", "sow": "Jun–Jul", "harvest": "Oct–Nov", "water": "Standing water required"},
    "maize":  {"season": "Kharif", "sow": "Jun–Jul", "harvest": "Sep–Oct", "water": "5–6 irrigations"},
    "cotton": {"season": "Kharif", "sow": "Apr–May", "harvest": "Oct–Dec", "water": "7–8 irrigations"},
    "tomato": {"season": "All",    "sow": "Jun/Oct",  "harvest": "90–120 days", "water": "Daily drip"},
    "potato": {"season": "Rabi",   "sow": "Oct–Nov", "harvest": "Feb–Mar", "water": "5–6 irrigations"},
    "onion":  {"season": "Rabi",   "sow": "Oct–Dec", "harvest": "Mar–Apr", "water": "Moderate"},
    "soybean":{"season": "Kharif", "sow": "Jun–Jul", "harvest": "Oct",     "water": "3–4 irrigations"},
}

MANDI_PRICES = {
    "wheat":   {"price": "₹2,275", "trend": "stable",  "best_market": "Punjab, Haryana"},
    "rice":    {"price": "₹2,183", "trend": "rising",  "best_market": "Punjab, AP, Telangana"},
    "maize":   {"price": "₹2,090", "trend": "rising",  "best_market": "Karnataka, MP"},
    "cotton":  {"price": "₹6,620", "trend": "stable",  "best_market": "Gujarat, Maharashtra"},
    "tomato":  {"price": "₹1,200–3,500/qt", "trend": "volatile", "best_market": "HP, Karnataka"},
    "potato":  {"price": "₹1,200", "trend": "falling", "best_market": "UP, West Bengal"},
    "onion":   {"price": "₹1,800", "trend": "rising",  "best_market": "Maharashtra, Karnataka"},
    "soybean": {"price": "₹4,600", "trend": "stable",  "best_market": "MP, Maharashtra"},
}

GOVT_SCHEMES = [
    {"name": "PM-KISAN",          "benefit": "₹6,000/year direct benefit transfer to farmers"},
    {"name": "PMFBY",             "benefit": "Crop insurance at 2% premium for Kharif, 1.5% for Rabi"},
    {"name": "Soil Health Card",  "benefit": "Free soil testing & nutrient recommendations"},
    {"name": "PM Krishi Sinchai", "benefit": "Subsidized drip & sprinkler irrigation systems"},
    {"name": "e-NAM",             "benefit": "Online mandi platform for better price discovery"},
    {"name": "KCC (Kisan Credit Card)", "benefit": "Short-term credit up to ₹3 lakh at 4% interest"},
    {"name": "RKVY",              "benefit": "Rashtriya Krishi Vikas Yojana — agri infrastructure grants"},
    {"name": "PKVY",              "benefit": "Paramparagat Krishi Vikas Yojana — organic farming support"},
]

PEST_GUIDE = {
    "aphids":     {"crop": "Many", "organic": "Neem oil 3ml/L spray", "chemical": "Imidacloprid 0.3ml/L"},
    "stem borer": {"crop": "Rice/Maize", "organic": "Trichogramma cards @ 50,000/ha", "chemical": "Chlorpyrifos 2ml/L"},
    "whitefly":   {"crop": "Cotton/Tomato", "organic": "Yellow sticky traps + neem oil", "chemical": "Thiamethoxam 0.2g/L"},
    "rust":       {"crop": "Wheat", "organic": "Trichoderma spray", "chemical": "Propiconazole 1ml/L"},
    "blight":     {"crop": "Potato/Tomato", "organic": "Copper oxychloride 3g/L", "chemical": "Mancozeb 2.5g/L"},
}

SEASONAL_TIPS = {
    "kharif":  ["Prepare fields after first rain", "Sow paddy, cotton, maize, soybean",
                "Apply basal dose of NPK before sowing", "Monitor for stem borer in rice"],
    "rabi":    ["Sow wheat, barley, mustard after Oct 15", "Irrigation critical at crown root initiation",
                "Apply urea top-dressing at tillering", "Harvest before April heat"],
    "zaid":    ["Grow vegetables, cucumber, watermelon", "Ensure irrigation every 3–4 days",
                "Use mulch to retain soil moisture", "Short duration crops preferred"],
    "pre-monsoon": ["Deep ploughing to conserve moisture", "Prepare compost pits",
                    "Repair bunds and irrigation channels", "Procure certified seeds early"],
}


def get_weather(city: str = "Delhi") -> dict:
    """Fetch live weather from OpenWeatherMap if key is set, else return mock data."""
    if OPENWEATHER_KEY and OPENWEATHER_KEY != "your_openweather_api_key_here":
        try:
            r = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": OPENWEATHER_KEY, "units": "metric"},
                timeout=10,
            )
            if r.ok:
                d = r.json()
                return {
                    "city": city,
                    "temp": f"{d['main']['temp']:.0f}°C",
                    "humidity": f"{d['main']['humidity']}%",
                    "description": d["weather"][0]["description"].title(),
                    "wind": f"{d['wind']['speed']} m/s",
                    "farming_advisory": _weather_advisory(
                        d["main"]["temp"], d["main"]["humidity"],
                        d["weather"][0]["main"]
                    ),
                }
        except Exception:
            pass  # Fall through to mock data

    # Mock data
    return {
        "city": city,
        "temp": "28°C",
        "humidity": "65%",
        "description": "Partly Cloudy",
        "wind": "12 km/h",
        "farming_advisory": "Good conditions for field work. Monitor soil moisture.",
        "note": "Live weather: Add OPENWEATHER_API_KEY in .env for real data",
    }


def _weather_advisory(temp: float, humidity: float, condition: str) -> str:
    if condition in ("Rain", "Drizzle", "Thunderstorm"):
        return "Rain expected — delay spraying operations. Check drainage."
    if temp > 38:
        return "High heat — irrigate in early morning or evening. Apply mulch."
    if temp < 10:
        return "Cold wave — protect sensitive crops. Consider frost covers."
    if humidity > 80:
        return "High humidity — risk of fungal diseases. Ensure good air circulation."
    return "Favorable conditions for field work and spraying."


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """Main application page."""
    return render_template("index.html",
                           app_name=os.getenv("APP_NAME", "Smart Farming Advisor"),
                           version=os.getenv("APP_VERSION", "1.0.0"))


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint — sends message to watsonx.ai Granite model."""
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    if not IBM_API_KEY or IBM_API_KEY == "your_ibm_cloud_api_key_here":
        return jsonify({
            "reply": (
                "⚠️ **IBM API Key not configured.**\n\n"
                "Please add your `IBM_API_KEY` and `WATSONX_PROJECT_ID` to the `.env` file.\n\n"
                "Visit [IBM Cloud](https://cloud.ibm.com/iam/apikeys) to get your key.\n\n"
                "🌾 Need more details? Just ask!"
            ),
            "timestamp": datetime.now().strftime("%H:%M"),
        })

    history = get_history()
    messages = build_messages(user_message, history)

    try:
        reply = call_watsonx(messages, max_tokens=800)
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else 0
        if status == 401:
            reply = "❌ Authentication failed. Please check your IBM_API_KEY in the .env file."
        elif status == 403:
            reply = "❌ Access denied. Verify your WATSONX_PROJECT_ID and model permissions."
        elif status == 429:
            reply = "⏳ Rate limit reached. Please wait a moment and try again."
        else:
            reply = f"❌ IBM watsonx.ai error ({status}). Please try again."
    except requests.ConnectionError:
        reply = "❌ Cannot connect to IBM watsonx.ai. Check your internet connection."
    except Exception as e:
        reply = f"❌ Unexpected error: {str(e)[:100]}"

    # Update session history
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    save_history(history)

    return jsonify({
        "reply": reply,
        "timestamp": datetime.now().strftime("%H:%M"),
    })


@app.route("/api/weather", methods=["GET"])
def weather():
    """Return weather data for a city."""
    city = request.args.get("city", "Delhi")
    return jsonify(get_weather(city))


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    """Return dashboard summary data."""
    crop = request.args.get("crop", "wheat").lower()
    season = _current_season()

    crop_info  = CROP_DATA.get(crop, CROP_DATA["wheat"])
    mandi_info = MANDI_PRICES.get(crop, {"price": "N/A", "trend": "unknown", "best_market": "Local mandi"})
    tips       = SEASONAL_TIPS.get(season, SEASONAL_TIPS["kharif"])

    return jsonify({
        "crop": crop.title(),
        "crop_info": crop_info,
        "mandi": mandi_info,
        "season": season.title(),
        "seasonal_tips": tips,
        "govt_schemes": GOVT_SCHEMES[:4],
        "weather": get_weather(),
        "soil_health_score": 74,
        "crop_health_score": 81,
        "irrigation_status": "Adequate",
        "next_irrigation": "2 days",
    })


@app.route("/api/crops", methods=["GET"])
def crops():
    """Return list of supported crops."""
    return jsonify({"crops": list(CROP_DATA.keys())})


@app.route("/api/mandi", methods=["GET"])
def mandi():
    """Return mandi price data."""
    crop = request.args.get("crop", "").lower()
    if crop and crop in MANDI_PRICES:
        return jsonify({crop: MANDI_PRICES[crop]})
    return jsonify(MANDI_PRICES)


@app.route("/api/schemes", methods=["GET"])
def schemes():
    """Return government scheme information."""
    return jsonify({"schemes": GOVT_SCHEMES})


@app.route("/api/pests", methods=["GET"])
def pests():
    """Return pest & disease guide."""
    pest = request.args.get("pest", "").lower()
    if pest and pest in PEST_GUIDE:
        return jsonify({pest: PEST_GUIDE[pest]})
    return jsonify(PEST_GUIDE)


@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():
    """Clear conversation history."""
    session.pop("chat_history", None)
    return jsonify({"status": "cleared"})


@app.route("/api/quick-advice", methods=["POST"])
def quick_advice():
    """Generate quick advice for a specific topic using watsonx.ai."""
    data    = request.get_json(silent=True) or {}
    topic   = data.get("topic", "general farming")
    crop    = data.get("crop", "wheat")
    location= data.get("location", "India")

    prompt = (
        f"Give me a concise, practical farming tip (3-4 sentences) about {topic} "
        f"for {crop} crop in {location}. Be specific and actionable."
    )

    if not IBM_API_KEY or IBM_API_KEY == "your_ibm_cloud_api_key_here":
        return jsonify({"advice": "Please configure your IBM API key to get AI-powered advice.", "topic": topic})

    try:
        messages = [
            {"role": "system", "content": AGENT_INSTRUCTIONS},
            {"role": "user",   "content": prompt},
        ]
        advice = call_watsonx(messages, max_tokens=200)
        return jsonify({"advice": advice, "topic": topic})
    except Exception as e:
        return jsonify({"advice": f"Unable to fetch advice: {str(e)[:80]}", "topic": topic})


def _current_season() -> str:
    month = datetime.now().month
    if 6 <= month <= 9:
        return "kharif"
    elif 10 <= month <= 3:
        return "rabi"
    elif 4 <= month <= 5:
        return "pre-monsoon"
    return "zaid"


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    print(f"\n{'='*55}")
    print(f"  🌾 Smart Farming Advisor — IBM watsonx.ai + Granite")
    print(f"  🚀 Running on http://localhost:{port}")
    print(f"  🤖 Model: {GRANITE_MODEL_ID}")
    print(f"  🔑 API Key: {'✅ Configured' if IBM_API_KEY and IBM_API_KEY != 'your_ibm_cloud_api_key_here' else '❌ NOT SET'}")
    print(f"{'='*55}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
