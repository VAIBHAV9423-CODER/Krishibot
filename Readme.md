# 🌾 KrishiBot – AI-Powered Smart Farming Advice Agent

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com)
[![IBM watsonx.ai](https://img.shields.io/badge/IBM-watsonx.ai-052FAD.svg)](https://www.ibm.com/watsonx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Jai Kisan! 🙏** — An intelligent farming assistant for Indian farmers powered by IBM Granite models, RAG, and comprehensive agricultural knowledge.

---

## 📌 Table of Contents
1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [IBM watsonx.ai Setup](#ibm-watsonxai-setup)
6. [Configuration (AGENT_INSTRUCTIONS & KNOWLEDGE_CONFIG)](#configuration)
7. [API Reference](#api-reference)
8. [Deployment](#deployment)
9. [Screenshots](#screenshots)
10. [Troubleshooting](#troubleshooting)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat Advisor** | Natural language farming Q&A powered by IBM Granite models |
| 📚 **RAG Engine** | Retrieval-Augmented Generation with 6 agricultural knowledge bases |
| 🌤️ **Weather Dashboard** | Real-time weather with farming-specific alerts |
| 🌱 **Crop Advisor** | Season/soil/state-based crop recommendations |
| 🪲 **Pest & Disease Guide** | IPM-based identification and management |
| 🌱 **Soil Health Advisor** | pH analysis, nutrient status, correction measures |
| 💊 **Fertilizer System** | NPK schedules, organic alternatives, biofertilizers |
| 💧 **Irrigation Planner** | Drip/sprinkler/flood scheduling by crop stage |
| 💰 **Market Prices** | MSP 2024-25 data, eNAM, selling channel guidance |
| 🏛️ **Government Schemes** | PM-KISAN, PMFBY, PMKSY, KCC, SHC and more |
| 🌐 **Multilingual** | English + Hindi + 7 regional Indian languages |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Mobile Responsive** | Mobile-first design with bottom navigation |
| 📊 **Charts** | Chart.js dashboards for weather, crops, soil, market |

---

## 📁 Project Structure

```
smartfarmingadviceagent/
├── app.py                      # Flask application + watsonx.ai + RAG
├── requirements.txt            # Python dependencies
├── .env.example               # Environment variable template
├── .env                       # Your secrets (DO NOT commit)
│
├── knowledge_base/             # RAG data sources
│   ├── crops.json             # 10 crops with full cultivation data
│   ├── soil_health.json       # Soil types, pH, nutrient management
│   ├── pest_disease.json      # Pests, diseases, IPM management
│   ├── fertilizers.json       # Chemical, organic, biofertilizers
│   ├── irrigation.json        # Drip, sprinkler, water conservation
│   └── schemes_market.json    # Government schemes, MSP, selling channels
│
├── templates/
│   └── index.html             # Main HTML template
│
├── static/
│   ├── css/
│   │   └── style.css          # All styling with dark mode
│   └── js/
│       └── main.js            # All interactivity + charts
│
└── utils/                     # Utility modules (extendable)
```

---

## ⚙️ Prerequisites

- **Python** 3.10 or higher
- **pip** (Python package manager)
- **IBM Cloud account** (free tier available)
- **Internet connection** (for watsonx.ai API calls)
- Optional: OpenWeatherMap API key (free)

---

## 🚀 Quick Start

### Step 1 — Clone / Download

```bash
# If using git
git clone https://github.com/yourusername/krishibot.git
cd krishibot

# Or simply navigate to the project folder
cd smartfarmingadviceagent
```

### Step 2 — Create Virtual Environment

```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

> ⏱️ First install may take 3–5 minutes (sentence-transformers model download).

### Step 4 — Configure Environment Variables

```bash
# Copy the example file
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux

# Edit .env with your values (see IBM Setup below)
notepad .env                # Windows
nano .env                   # Linux/macOS
```

### Step 5 — Run the Application

```bash
python app.py
```

Open your browser: **http://localhost:5000**

> 💡 The app works in **Demo Mode** even without IBM API keys — great for testing the UI!

---

## 🔑 IBM watsonx.ai Setup

### Step 1: Create IBM Cloud Account
1. Visit [cloud.ibm.com](https://cloud.ibm.com) and sign up for free
2. No credit card required for the Lite/Free tier

### Step 2: Create Watson Machine Learning Service
1. Go to **IBM Cloud Catalog** → Search "Watson Machine Learning"
2. Select the **Lite (free)** plan
3. Click **Create**

### Step 3: Create watsonx.ai Project
1. Visit [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)
2. Click **New Project** → **Create an empty project**
3. Enter a project name (e.g., "KrishiBot")
4. Associate your Watson Machine Learning service
5. Note your **Project ID** from Settings → General

### Step 4: Get IBM Cloud API Key
1. Go to **IBM Cloud Console** → Click your profile icon → **IBM Cloud API keys**
2. Click **Create an IBM Cloud API key**
3. Name it "KrishiBot Key" and note the key value (shown only once)

### Step 5: Update `.env` File

```env
IBM_API_KEY=7350950a-fd72-4709-b931-8c4576905811
IBM_PROJECT_ID=fc7a1eb0-a7ed-4f47-98b6-3467a5e8b85b
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

### Step 6: (Optional) OpenWeatherMap API Key
1. Register at [openweathermap.org](https://openweathermap.org/api)
2. Get free API key from "My API Keys"
3. Add to `.env`:
   ```env
   WEATHER_API_KEY=your_weather_api_key
   ```

---

## ⚙️ Configuration

KrishiBot has two configuration sections in `app.py` that you can easily modify:

### `AGENT_INSTRUCTIONS` — Control the AI's behavior

```python
AGENT_INSTRUCTIONS = {
    "name": "KrishiBot",                    # Agent name
    "role": "Expert AI Agricultural Advisor",
    
    # Change response style
    "response_style": {
        "format": "structured",             # "structured" | "conversational"
        "use_bullet_points": True,
        "include_quantities": True,
        "local_language_terms": True,
    },
    
    # Add/remove safety rules
    "safety_rules": [
        "Never recommend banned pesticides",
        "Always mention PPE for pesticide use",
        # Add your own rules here
    ],
    
    # Set supported languages
    "supported_languages": {
        "primary": "English",
        "secondary": ["Hindi", "Telugu", ...],
    },
    
    # Focus on specific crops (for your region)
    "crop_focus": ["Rice", "Wheat", "Cotton", ...],
}
```

### `KNOWLEDGE_CONFIG` — Control RAG retrieval

```python
KNOWLEDGE_CONFIG = {
    # Point to your knowledge files
    "knowledge_files": {
        "crops": "knowledge_base/crops.json",
        # Add more sources here
    },
    
    # Tune retrieval parameters
    "retrieval": {
        "chunk_size": 512,      # Larger = more context, slower
        "top_k": 5,             # More results = more comprehensive
        "similarity_threshold": 0.2,
        "embedding_model": "paraphrase-multilingual-MiniLM-L12-v2",
    },
}
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Main web application |
| `POST` | `/api/chat` | Send chat message, receive AI response |
| `GET`  | `/api/weather?city=<city>` | Weather data for a city |
| `POST` | `/api/crop-recommendations` | Get crop recommendations |
| `GET`  | `/api/market-prices` | MSP and market information |
| `GET`  | `/api/schemes` | Government schemes list |
| `GET`  | `/api/quick-queries` | Suggested farming questions |
| `GET`  | `/api/status` | System health check |
| `POST` | `/api/clear-history` | Clear chat history |

### Chat API Example

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What fertilizer should I use for wheat?", "language": "en"}'
```

```json
{
  "response": "For wheat cultivation, the recommended NPK dose is...",
  "model": "ibm/granite-13b-instruct-v2",
  "demo_mode": false,
  "timestamp": "2024-07-14T10:00:00.000000"
}
```

---

## 🚀 Deployment

### Local Development (Default)

```bash
python app.py
# Runs on http://localhost:5000
```

### Production with Gunicorn (Linux/macOS)

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5000 --timeout 120 app:app
```

### Docker Deployment

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t krishibot .
docker run -p 5000:5000 --env-file .env krishibot
```

### IBM Code Engine / Cloud Foundry
```bash
# Install IBM Cloud CLI first
ibmcloud login
ibmcloud target --cf
ibmcloud cf push krishibot -m 512M
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError: sentence_transformers` | Run `pip install sentence-transformers faiss-cpu` |
| `IBM API Error: 401 Unauthorized` | Check `IBM_API_KEY` in `.env` is correct |
| `IBM API Error: 404 Not Found` | Verify `IBM_PROJECT_ID` is correct |
| `RAG returns empty context` | Check `knowledge_base/` folder has JSON files |
| Slow first response | Normal – embedding model loads on first request (~30s) |
| Weather shows demo data | Add valid `WEATHER_API_KEY` to `.env` |
| Chart.js not loading | Check internet connection (CDN dependency) |

### Checking Logs
```bash
# The app logs INFO-level messages
python app.py 2>&1 | tee krishibot.log
```

---

## 📋 Environment Variables Reference

```env
# Required for AI functionality
IBM_API_KEY=                    # IBM Cloud API Key
IBM_PROJECT_ID=                 # watsonx.ai Project ID
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Flask settings
FLASK_SECRET_KEY=random_string  # Change in production!
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_PORT=5000

# Optional integrations
WEATHER_API_KEY=                # OpenWeatherMap API key
DEFAULT_CITY=New Delhi

# RAG tuning
RAG_CHUNK_SIZE=512
RAG_CHUNK_OVERLAP=64
RAG_TOP_K=5

# App settings
MAX_CHAT_HISTORY=20
DEFAULT_LANGUAGE=en
```

---

## 🌐 Adding More Languages

1. Add language option to `index.html` language selector
2. Map language code in `app.py` → `chat()` route
3. The multilingual embedding model handles Indian languages natively

---

## 📊 Extending the Knowledge Base

Add a new JSON file to `knowledge_base/` and register it:

```python
# In app.py KNOWLEDGE_CONFIG
"knowledge_files": {
    "existing_key": "knowledge_base/existing.json",
    "my_new_topic": "knowledge_base/my_new_topic.json",  # Add this
}
```

The RAG engine will automatically index and retrieve from it.

---

## 🙏 Acknowledgements

- [IBM watsonx.ai](https://www.ibm.com/watsonx) — Granite foundation models
- [ICAR](https://icar.org.in) — Agricultural knowledge base
- [Government of India](https://agricoop.gov.in) — Scheme and MSP data
- [Bootstrap 5](https://getbootstrap.com) — UI framework
- [Chart.js](https://chartjs.org) — Data visualizations
- [Font Awesome](https://fontawesome.com) — Icons

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

**Jai Kisan! Jai Hind! 🌾🇮🇳**

*Built with ❤️ for Indian farmers*
