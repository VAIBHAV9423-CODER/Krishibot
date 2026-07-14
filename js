/* ===================================================================
   KrishiBot – Smart Farming Advice Agent
   Main JavaScript
   =================================================================== */

'use strict';

// ─── State ─────────────────────────────────────────────────────────
const state = {
  currentPanel: 'chat',
  language: 'en',
  darkMode: false,
  isTyping: false,
  charts: {},
  marketData: null,
  schemesData: [],
};

// ─── DOM helpers ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('en-IN').format(n);

// ─── Initialization ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initGreeting();
  initDarkMode();
  initChatInput();
  loadStatus();
  loadQuickQueries();
  loadWeather();
  loadMarketPrices();
  loadSchemes();
  initCharts();
  setInterval(loadStatus, 30_000);
});

// ─── Greeting ──────────────────────────────────────────────────────
function initGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const greetings = {
    morning: ['Good Morning! 🌅', 'Suprabhat! 🌄', 'Sat Sri Akal! 🙏'],
    afternoon: ['Good Afternoon! ☀️', 'Namaste! 🙏', 'Jai Kisan! 🌾'],
    evening: ['Good Evening! 🌙', 'Namaste! 🙏', 'Jai Hind! 🇮🇳'],
  };
  const grpKey = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const grp = greetings[grpKey];
  $('greetingText').textContent = grp[Math.floor(Math.random() * grp.length)];
  $('greetingDate').textContent = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

// ─── Dark mode ─────────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('krishibot-dark') === 'true';
  applyDarkMode(saved);
  $('darkModeBtn').addEventListener('click', () => applyDarkMode(!state.darkMode));
}
function applyDarkMode(on) {
  state.darkMode = on;
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  $('darkModeIcon').className = on ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  localStorage.setItem('krishibot-dark', on);
}

// ─── Language ──────────────────────────────────────────────────────
$('languageSelect').addEventListener('change', function () {
  state.language = this.value;
  showToast(`Language set – next response will be in ${this.options[this.selectedIndex].text}`);
});

// ─── Panel switching ────────────────────────────────────────────────
function showPanel(panelId, btnEl) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  // Deactivate sidebar buttons
  document.querySelectorAll('.sidebar-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));

  // Show target panel
  const panel = $(`panel-${panelId}`);
  if (panel) panel.classList.add('active');

  // Mark active nav buttons
  document.querySelectorAll(`[data-panel="${panelId}"]`).forEach(b => b.classList.add('active'));

  state.currentPanel = panelId;

  // Lazy-load panel data
  if (panelId === 'weather') loadWeather();
  if (panelId === 'market')  loadMarketPrices();
  if (panelId === 'schemes') loadSchemes();
}

// ─── System status ─────────────────────────────────────────────────
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const dot  = $('statusDot');
    const txt  = $('statusText');

    if (data.watsonx?.ready) {
      dot.className = 'status-dot online';
      txt.textContent = 'Live';
      $('modelInfo').textContent = `IBM ${data.watsonx.model?.split('/').pop() ?? 'Granite'} • RAG (${data.rag_chunks} chunks)`;
    } else if (data.watsonx?.demo_mode) {
      dot.className = 'status-dot demo';
      txt.textContent = 'Demo Mode';
      $('modelInfo').textContent = 'Demo Mode – Add IBM API key for full AI';
    } else {
      dot.className = 'status-dot error';
      txt.textContent = 'Error';
    }
  } catch {
    $('statusDot').className = 'status-dot error';
    $('statusText').textContent = 'Offline';
  }
}

// ─── Quick queries ─────────────────────────────────────────────────
async function loadQuickQueries() {
  try {
    const res = await fetch('/api/quick-queries');
    const { queries } = await res.json();
    const container = $('quickQueriesScroll');
    container.innerHTML = queries.map(q =>
      `<button class="quick-query-btn" onclick="sendQuickQuery(this)"
               data-text="${escHtml(q.text)}">
         ${q.icon} ${escHtml(q.text)}
       </button>`
    ).join('');
  } catch {
    $('quickQueriesScroll').innerHTML = '';
  }
}
function sendQuickQuery(btn) {
  const text = btn.dataset.text;
  $('chatInput').value = text;
  autoResizeInput();
  sendMessage();
}

// ─── Chat ──────────────────────────────────────────────────────────
function initChatInput() {
  const input = $('chatInput');
  input.addEventListener('input', () => {
    autoResizeInput();
    $('charCounter').textContent = `${input.value.length}/1000`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function autoResizeInput() {
  const ta = $('chatInput');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}

async function sendMessage() {
  const input = $('chatInput');
  const message = input.value.trim();
  if (!message || state.isTyping) return;

  // Append user message
  appendMessage(message, 'user');
  input.value = '';
  autoResizeInput();
  $('charCounter').textContent = '0/1000';

  // Show typing indicator
  state.isTyping = true;
  $('sendBtn').disabled = true;
  const typingEl = appendTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language: state.language }),
    });
    const data = await res.json();
    typingEl.remove();

    if (data.error) {
      appendMessage(`⚠️ Error: ${data.error}`, 'bot', true);
    } else {
      appendMessage(data.response, 'bot', data.demo_mode);
    }
  } catch (err) {
    typingEl.remove();
    appendMessage('⚠️ Network error. Please check your connection and try again.', 'bot', true);
  } finally {
    state.isTyping = false;
    $('sendBtn').disabled = false;
    $('chatInput').focus();
  }
}

function appendMessage(text, role, isDemo = false) {
  const chatWindow = $('chatWindow');
  const div = document.createElement('div');
  div.className = `chat-message ${role === 'user' ? 'user-message' : 'bot-message'}`;

  const avatar = role === 'user'
    ? `<div class="msg-avatar user-avatar"><i class="fa-solid fa-user"></i></div>`
    : `<div class="msg-avatar bot-avatar">🌾</div>`;

  const demoTag = (role === 'bot' && isDemo)
    ? `<div class="demo-badge"><i class="fa-solid fa-triangle-exclamation"></i> Demo – Add IBM API key for full AI</div>`
    : '';

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    ${avatar}
    <div class="msg-bubble">
      <div class="msg-content">${formatBotText(text)}</div>
      ${demoTag}
      <div class="msg-time">${now}</div>
    </div>`;

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function appendTypingIndicator() {
  const chatWindow = $('chatWindow');
  const div = document.createElement('div');
  div.className = 'chat-message bot-message';
  div.innerHTML = `
    <div class="msg-avatar bot-avatar">🌾</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function formatBotText(text) {
  // Convert markdown-like formatting to HTML
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<h6 class="mt-2 mb-1 text-success fw-bold">$1</h6>')
    .replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="mb-2">$&</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hul])(.+)/, '<p>$1</p>');
}

function clearChat() {
  fetch('/api/clear-history', { method: 'POST' });
  const chatWindow = $('chatWindow');
  // Keep welcome message
  const welcome = $('welcomeMessage');
  chatWindow.innerHTML = '';
  if (welcome) chatWindow.appendChild(welcome);
  showToast('Conversation cleared.');
}

// ─── Weather ────────────────────────────────────────────────────────
async function loadWeather(city) {
  const cityInput = $('weatherCity');
  const queryCity = city || (cityInput ? cityInput.value : 'New Delhi');

  $('weatherCards').innerHTML = `
    <div class="col-12 text-center py-4">
      <div class="spinner-border text-success"></div>
      <p class="mt-2 text-muted">Loading weather…</p>
    </div>`;
  $('farmingAlert').style.display = 'none';

  try {
    const res  = await fetch(`/api/weather?city=${encodeURIComponent(queryCity)}`);
    const data = await res.json();

    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
    const demoNote = data.demo
      ? '<div class="demo-badge mt-2"><i class="fa-solid fa-triangle-exclamation"></i> Demo data – add WEATHER_API_KEY for real weather</div>'
      : '';

    $('weatherCards').innerHTML = `
      <div class="col-md-5">
        <div class="weather-card">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <div class="weather-city"><i class="fa-solid fa-location-dot me-1"></i>${escHtml(data.city)}</div>
              <div class="weather-temp">${data.temperature.toFixed(1)}°C</div>
              <div class="weather-desc">${escHtml(data.description)}</div>
              <div class="mt-1" style="font-size:.8rem;opacity:.8">Feels like ${data.feels_like.toFixed(1)}°C</div>
              ${demoNote}
            </div>
            <img src="${iconUrl}" alt="${escHtml(data.description)}" width="72" onerror="this.style.display='none'">
          </div>
        </div>
      </div>
      <div class="col-md-7">
        <div class="row g-2">
          <div class="col-6">
            <div class="weather-detail text-white">
              <div class="weather-detail-val"><i class="fa-solid fa-droplet me-1"></i>${data.humidity}%</div>
              <div class="weather-detail-lbl">Humidity</div>
            </div>
          </div>
          <div class="col-6">
            <div class="weather-detail text-white">
              <div class="weather-detail-val"><i class="fa-solid fa-wind me-1"></i>${data.wind_speed} km/h</div>
              <div class="weather-detail-lbl">Wind Speed</div>
            </div>
          </div>
          <div class="col-6">
            <div class="weather-detail text-white">
              <div class="weather-detail-val"><i class="fa-solid fa-gauge me-1"></i>${data.pressure}</div>
              <div class="weather-detail-lbl">Pressure (hPa)</div>
            </div>
          </div>
          <div class="col-6">
            <div class="weather-detail text-white">
              <div class="weather-detail-val"><i class="fa-solid fa-thermometer-half me-1"></i>${data.temperature.toFixed(0)}°C</div>
              <div class="weather-detail-lbl">Temperature</div>
            </div>
          </div>
        </div>
      </div>`;

    if (data.farming_alert) {
      $('farmingAlert').style.display = 'block';
      $('farmingAlert').innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>${escHtml(data.farming_alert)}`;
    }
  } catch (err) {
    $('weatherCards').innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load weather data. ${err.message}</div></div>`;
  }
}

// ─── Crop Recommendations ───────────────────────────────────────────
async function loadCropRecommendations() {
  const season   = $('cropSeason').value;
  const soilType = $('cropSoil').value;
  const state_   = $('cropState').value;

  const result = $('cropRecommendationsResult');
  result.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-success"></div><p class="mt-2 text-muted">Analyzing best crops…</p></div>`;

  try {
    const res = await fetch('/api/crop-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season, soil_type: soilType, state: state_ }),
    });
    const data = await res.json();

    if (!data.recommendations?.length) {
      result.innerHTML = `<div class="alert alert-info">No specific recommendations found. Please select season, soil type, or state to narrow results. Try asking KrishiBot in the chat panel!</div>`;
      return;
    }

    const html = `
      <h6 class="mb-3 text-success"><i class="fa-solid fa-seedling me-2"></i>${data.count} Recommended Crops</h6>
      <div class="row g-3">
        ${data.recommendations.map(crop => `
          <div class="col-md-4 fade-in">
            <div class="crop-card">
              <div class="crop-card-title">${escHtml(crop.name)}</div>
              <div class="crop-card-hindi">${escHtml(crop.hindi)}</div>
              ${crop.season.map(s => `<span class="crop-badge">${s}</span>`).join('')}
              <div class="crop-info-row mt-2">
                <i class="fa-solid fa-chart-line"></i>
                <span>Yield: ${escHtml(crop.yield)}</span>
              </div>
              <div class="crop-info-row">
                <i class="fa-solid fa-droplet"></i>
                <span>${escHtml(crop.water)}</span>
              </div>
              ${crop.reasons.map(r => `<div class="crop-info-row"><i class="fa-solid fa-check-circle text-success"></i><span>${escHtml(r)}</span></div>`).join('')}
              ${crop.tips ? `<div class="mt-2 p-2 rounded" style="background:var(--bg-body);font-size:.78rem;color:var(--text-secondary)"><i class="fa-solid fa-lightbulb text-warning me-1"></i>${escHtml(crop.tips)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
    result.innerHTML = html;
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

// ─── Soil Analysis ──────────────────────────────────────────────────
function analyzeSoil() {
  const ph       = parseFloat($('soilPH').value);
  const oc       = parseFloat($('soilOC').value);
  const soilType = $('soilTypeInput').value;
  const result   = $('soilAnalysisResult');

  if (isNaN(ph) && isNaN(oc) && !soilType) {
    result.innerHTML = `<div class="alert alert-warning">Please enter at least one soil parameter to analyze.</div>`;
    return;
  }

  let phStatus = '', phColor = '', phAdvice = '', phPct = 50;
  if (!isNaN(ph)) {
    if (ph < 5.5) {
      phStatus = 'Strongly Acidic'; phColor = '#ef5350';
      phAdvice = 'Apply agricultural lime (CaCO₃) at 2–4 tonnes/ha. Grow acid-tolerant crops (tea, rice, areca nut) in the interim.';
      phPct = Math.max(0, ph / 14 * 100);
    } else if (ph < 6.0) {
      phStatus = 'Moderately Acidic'; phColor = '#ff9800';
      phAdvice = 'Apply dolomite limestone at 1–2 tonnes/ha. Suitable for rice, groundnut, potatoes.';
      phPct = ph / 14 * 100;
    } else if (ph <= 7.5) {
      phStatus = '✅ Ideal Range'; phColor = '#4caf50';
      phAdvice = 'Excellent! Soil pH is in the ideal range (6–7.5). Most nutrients are available. Continue good soil management practices.';
      phPct = ph / 14 * 100;
    } else if (ph <= 8.5) {
      phStatus = 'Alkaline'; phColor = '#2196f3';
      phAdvice = 'Apply gypsum (CaSO₄) at 2–5 tonnes/ha to reduce alkalinity. Grow salt-tolerant crops. Improve drainage. Add organic matter.';
      phPct = ph / 14 * 100;
    } else {
      phStatus = 'Strongly Alkaline'; phColor = '#9c27b0';
      phAdvice = 'Severe alkalinity. Apply gypsum + sulphur. Reclamation required before normal cropping. Consult soil scientist.';
      phPct = ph / 14 * 100;
    }
  }

  let ocStatus = '', ocAdvice = '';
  if (!isNaN(oc)) {
    if (oc < 0.5) {
      ocStatus = '🔴 Low (< 0.5%)';
      ocAdvice = 'Critical: Apply FYM 15–20 tonnes/ha + green manuring + vermicompost. Organic matter is very low.';
    } else if (oc < 0.75) {
      ocStatus = '🟡 Marginal (0.5–0.75%)';
      ocAdvice = 'Apply FYM 10–15 tonnes/ha. Practice crop rotation with legumes. Incorporate crop residues.';
    } else if (oc < 1.5) {
      ocStatus = '🟢 Adequate (0.75–1.5%)';
      ocAdvice = 'Good organic carbon level. Maintain by annual FYM/compost application and crop rotation.';
    } else {
      ocStatus = '🌿 Rich (> 1.5%)';
      ocAdvice = 'Excellent soil organic matter. Continue organic farming practices to maintain this level.';
    }
  }

  result.innerHTML = `
    <div class="soil-result-card fade-in">
      <h6 class="text-success mb-4"><i class="fa-solid fa-flask-vial me-2"></i>Soil Health Analysis Report</h6>
      ${!isNaN(ph) ? `
        <div class="mb-4">
          <div class="d-flex justify-content-between mb-1">
            <span class="fw-semibold">Soil pH: ${ph}</span>
            <span style="color:${phColor}">${phStatus}</span>
          </div>
          <div class="soil-ph-meter">
            <div class="soil-ph-pointer" style="left:${phPct}%"></div>
          </div>
          <div class="d-flex justify-content-between" style="font-size:.72rem;color:var(--text-muted)">
            <span>0 (Acidic)</span><span>7 (Neutral)</span><span>14 (Alkaline)</span>
          </div>
          <div class="mt-2 p-2 rounded" style="background:var(--bg-body);font-size:.83rem">
            <i class="fa-solid fa-lightbulb text-warning me-1"></i>${escHtml(phAdvice)}
          </div>
        </div>` : ''}
      ${!isNaN(oc) ? `
        <div class="mb-3">
          <div class="fw-semibold mb-1">Organic Carbon: ${oc}% — <span style="font-weight:400">${ocStatus}</span></div>
          <div class="p-2 rounded" style="background:var(--bg-body);font-size:.83rem">
            <i class="fa-solid fa-leaf text-success me-1"></i>${escHtml(ocAdvice)}
          </div>
        </div>` : ''}
      ${soilType ? `
        <div class="mb-3">
          <div class="fw-semibold mb-1"><i class="fa-solid fa-layer-group text-success me-1"></i>Soil Type: ${escHtml(soilType)}</div>
          <div class="p-2 rounded" style="background:var(--bg-body);font-size:.83rem">
            ${getSoilTypeInfo(soilType)}
          </div>
        </div>` : ''}
      <div class="mt-3 p-3 rounded" style="background:#e8f5e9;border:1px solid #c8e6c9">
        <div class="fw-semibold text-success mb-1"><i class="fa-solid fa-id-card me-2"></i>Get Your FREE Soil Health Card</div>
        <div style="font-size:.82rem;color:#2e7d32">Visit your nearest KVK (Krishi Vigyan Kendra) or Agriculture Department office.
        Website: <strong>soilhealth.dac.gov.in</strong> | Kisan Helpline: <strong>1800-180-1551</strong></div>
      </div>
    </div>`;

  updateSoilChart(ph, oc);
}

function getSoilTypeInfo(type) {
  const info = {
    'Alluvial':       'Highly fertile, rich in potash. Common in Indo-Gangetic plains. Good for rice, wheat, sugarcane. Needs regular N & P supplementation.',
    'Black Cotton':   'High water retention, rich in Ca & Mg. Ideal for cotton, soybean, wheat. Deep ploughing recommended. Needs N & P.',
    'Red & Yellow':   'Porous, good drainage, low fertility. Suitable for groundnut, cotton, millet. Heavy organic manuring required.',
    'Laterite':       'Acidic, iron-rich, poor in NPK. Good for tea, coffee, cashew. Heavy liming and manuring needed.',
    'Sandy':          'Low water retention, low fertility. Good for bajra, groundnut with drip irrigation. Needs mulching and heavy organics.',
  };
  return `<i class="fa-solid fa-info-circle text-info me-1"></i>${info[type] || 'Apply soil test for specific nutrient recommendations.'}`;
}

function updateSoilChart(ph, oc) {
  const ctx = document.getElementById('soilNutrientChart')?.getContext('2d');
  if (!ctx) return;
  if (state.charts.soil) state.charts.soil.destroy();

  const safeph = isNaN(ph) ? 6.5 : ph;
  // Calculate simulated nutrient availability based on pH
  const navail = ph < 6 ? 55 : ph > 8 ? 60 : 80;
  const pavail = ph < 5.5 ? 30 : ph > 7.5 ? 50 : 75;
  const kavail = ph < 5 ? 50 : ph > 8.5 ? 60 : 80;
  const caavail = ph < 5 ? 40 : ph > 8 ? 90 : 75;
  const mgavail = ph < 5 ? 45 : ph > 8 ? 85 : 70;
  const znavail = ph < 5 ? 80 : ph > 7 ? 30 : 70;

  state.charts.soil = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Calcium (Ca)', 'Magnesium (Mg)', 'Zinc (Zn)'],
      datasets: [{
        label: 'Nutrient Availability (%)',
        data: [navail, pavail, kavail, caavail, mgavail, znavail],
        backgroundColor: ['#43a047','#fb8c00','#1e88e5','#8e24aa','#e53935','#00897b'],
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: '% Availability' } }
      }
    }
  });
}

// ─── Pest & Disease Info ────────────────────────────────────────────
async function loadPestInfo() {
  const crop = $('pestCrop').value;
  const type = $('problemType').value;
  if (!crop) return;

  const result = $('pestInfoResult');
  result.innerHTML = `<div class="text-center py-3"><div class="spinner-border text-success"></div></div>`;

  try {
    const res = await fetch('/knowledge_base/pest_disease.json').catch(() => null);
    // Use the chat API to get pest info
    const chatRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `List the major ${type === 'pest' ? 'pests' : type === 'disease' ? 'diseases' : 'pests and diseases'} of ${crop} with symptoms, identification, and management recommendations using IPM approach.`,
        language: 'en',
      }),
    });
    const data = await chatRes.json();
    result.innerHTML = `
      <div class="card fade-in">
        <div class="card-header">
          <i class="fa-solid fa-${type === 'disease' ? 'bacterium' : 'bug'}"></i>
          Pest & Disease Guide – ${escHtml(crop)}
          ${data.demo_mode ? '<span class="demo-badge ms-2">Demo</span>' : ''}
        </div>
        <div class="card-body">
          <div style="font-size:.88rem;line-height:1.7">${formatBotText(data.response)}</div>
        </div>
      </div>`;
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">Error loading pest info: ${err.message}</div>`;
  }
}

// ─── Fertilizer Advice ──────────────────────────────────────────────
async function getFertilizerAdvice() {
  const crop   = $('fertCrop').value;
  const method = $('fertMethod').value;
  const result = $('fertilizerResult');

  if (!crop) {
    result.innerHTML = `<div class="alert alert-warning">Please select a crop first.</div>`;
    return;
  }

  result.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-success"></div><p class="mt-2 text-muted">Getting fertilizer recommendations…</p></div>`;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Provide detailed ${method} fertilizer recommendations for ${crop} including NPK doses, schedule, organic alternatives, and micronutrient management. Include application timings and quantities in kg/ha.`,
        language: 'en',
      }),
    });
    const data = await res.json();
    result.innerHTML = `
      <div class="card fade-in">
        <div class="card-header">
          <i class="fa-solid fa-flask"></i> Fertilizer Plan – ${escHtml(crop)}
          ${data.demo_mode ? '<span class="demo-badge ms-2">Demo</span>' : ''}
        </div>
        <div class="card-body">
          <div style="font-size:.88rem;line-height:1.7">${formatBotText(data.response)}</div>
        </div>
      </div>`;
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

// ─── Irrigation Plan ───────────────────────────────────────────────
async function getIrrigationPlan() {
  const crop   = $('irrigCrop').value;
  const system = $('irrigSystem').value;
  const result = $('irrigationResult');

  if (!crop) {
    result.innerHTML = `<div class="alert alert-warning">Please select a crop.</div>`;
    return;
  }

  result.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-success"></div></div>`;

  const systemName = { drip: 'Drip', sprinkler: 'Sprinkler', flood: 'Flood/Furrow' }[system];
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Provide an irrigation schedule for ${crop} using ${systemName} irrigation. Include critical growth stages, water requirement at each stage, irrigation intervals, and water-saving tips.`,
      language: 'en',
    }),
  });
  const data = await res.json();
  result.innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <i class="fa-solid fa-droplet"></i> Irrigation Plan – ${escHtml(crop)} (${systemName})
        ${data.demo_mode ? '<span class="demo-badge ms-2">Demo</span>' : ''}
      </div>
      <div class="card-body">
        <div style="font-size:.88rem;line-height:1.7">${formatBotText(data.response)}</div>
      </div>
    </div>`;
}

// ─── Market Prices ─────────────────────────────────────────────────
async function loadMarketPrices() {
  const result = $('marketPricesResult');
  if (!result) return;

  try {
    const res  = await fetch('/api/market-prices');
    const data = await res.json();
    state.marketData = data;

    const kharifRows = Object.entries(data.msp_kharif || {}).map(([k, v]) =>
      `<tr><td>${escHtml(k)}</td><td class="msp-price">${escHtml(v)}</td></tr>`
    ).join('');

    const rabiRows = Object.entries(data.msp_rabi || {}).map(([k, v]) =>
      `<tr><td>${escHtml(k)}</td><td class="msp-price">${escHtml(v)}</td></tr>`
    ).join('');

    const channelHtml = (data.selling_channels || []).map(c => `
      <div class="mb-3">
        <div class="fw-semibold"><i class="fa-solid fa-store text-success me-2"></i>${escHtml(c.channel)}</div>
        <div class="text-secondary" style="font-size:.83rem">${escHtml(c.description)}</div>
        ${c.tip ? `<div class="mt-1" style="font-size:.8rem;color:var(--clr-primary)"><i class="fa-solid fa-lightbulb me-1"></i>${escHtml(c.tip)}</div>` : ''}
      </div>`).join('');

    result.innerHTML = `
      <div class="row g-4 fade-in">
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-header"><i class="fa-solid fa-wheat-awn"></i> Kharif MSP 2024-25</div>
            <div class="card-body p-0">
              <table class="table table-sm table-striped msp-table mb-0">
                <thead><tr><th>Crop</th><th>MSP / Quintal</th></tr></thead>
                <tbody>${kharifRows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-header"><i class="fa-solid fa-seedling"></i> Rabi MSP 2024-25</div>
            <div class="card-body p-0">
              <table class="table table-sm table-striped msp-table mb-0">
                <thead><tr><th>Crop</th><th>MSP / Quintal</th></tr></thead>
                <tbody>${rabiRows}</tbody>
              </table>
            </div>
          </div>
          <div class="card mt-3">
            <div class="card-header"><i class="fa-solid fa-store"></i> Selling Channels</div>
            <div class="card-body">${channelHtml}</div>
          </div>
        </div>
      </div>
      <div class="alert alert-info mt-3" style="font-size:.8rem">
        <i class="fa-solid fa-info-circle me-2"></i>${escHtml(data.note || '')}
        Live mandi prices: <strong>agmarknet.gov.in</strong> | eNAM: <strong>enam.gov.in</strong>
      </div>`;

    updateMarketChart(data);
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">Error loading market prices: ${err.message}</div>`;
  }
}

// ─── Government Schemes ────────────────────────────────────────────
async function loadSchemes() {
  const result = $('schemesResult');
  if (!result) return;

  try {
    const res  = await fetch('/api/schemes');
    const data = await res.json();
    state.schemesData = data.schemes || [];
    renderSchemes(state.schemesData);
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
}

function filterSchemes(query) {
  if (!state.schemesData.length) return;
  const lower = query.toLowerCase();
  const filtered = state.schemesData.filter(s =>
    s.name.toLowerCase().includes(lower) ||
    s.benefit.toLowerCase().includes(lower) ||
    (s.eligibility || '').toLowerCase().includes(lower)
  );
  renderSchemes(filtered);
}

function renderSchemes(schemes) {
  const result = $('schemesResult');
  if (!schemes.length) {
    result.innerHTML = `<div class="alert alert-info">No schemes found for your search.</div>`;
    return;
  }
  result.innerHTML = schemes.map(s => `
    <div class="scheme-card fade-in">
      <div class="scheme-title">${escHtml(s.name)}</div>
      <div class="scheme-ministry"><i class="fa-solid fa-building-columns me-1"></i>${escHtml(s.ministry || '')}</div>
      <div class="scheme-benefit"><i class="fa-solid fa-gift me-2"></i>${escHtml(s.benefit)}</div>
      ${s.eligibility ? `<div class="scheme-detail"><strong>Eligibility:</strong> ${escHtml(s.eligibility)}</div>` : ''}
      ${s.how_to_apply ? `<div class="scheme-detail mt-1"><strong>How to Apply:</strong> ${escHtml(s.how_to_apply)}</div>` : ''}
      ${s.helpline ? `<div class="scheme-detail mt-1"><i class="fa-solid fa-phone me-1 text-success"></i><strong>Helpline:</strong> ${escHtml(s.helpline)}</div>` : ''}
      ${s.website ? `<a href="${escHtml(s.website)}" target="_blank" rel="noopener" class="scheme-link"><i class="fa-solid fa-external-link"></i>${escHtml(s.website)}</a>` : ''}
    </div>`).join('');
}

// ─── Charts ─────────────────────────────────────────────────────────
function initCharts() {
  initWeatherChart();
  initCropCalendarChart();
  initFertChart();
  initIrrigChart();
  updateSoilChart(6.5, 0.8);
}

function initWeatherChart() {
  const ctx = document.getElementById('weatherChart')?.getContext('2d');
  if (!ctx) return;
  state.charts.weather = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Rice', 'Wheat', 'Maize', 'Cotton', 'Soybean', 'Groundnut'],
      datasets: [
        {
          label: 'Temp Suitability',
          data: [85, 70, 90, 80, 75, 80],
          borderColor: '#43a047', backgroundColor: 'rgba(67,160,71,.15)', pointRadius: 4,
        },
        {
          label: 'Humidity Suitability',
          data: [90, 65, 75, 60, 80, 65],
          borderColor: '#0288d1', backgroundColor: 'rgba(2,136,209,.1)', pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 25 } } }
    }
  });
}

function initCropCalendarChart() {
  const ctx = document.getElementById('cropCalendarChart')?.getContext('2d');
  if (!ctx) return;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  state.charts.cropCal = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Kharif sowing', data: [0,0,0,0,0,10,10,0,0,0,0,0], backgroundColor: '#43a047', stack: 'k' },
        { label: 'Kharif harvest', data: [0,0,0,0,0,0,0,0,5,10,5,0], backgroundColor: '#81c784', stack: 'kh' },
        { label: 'Rabi sowing',   data: [0,0,0,0,0,0,0,0,0,10,10,0], backgroundColor: '#f57f17', stack: 'r' },
        { label: 'Rabi harvest',  data: [0,5,5,5,0,0,0,0,0,0,0,0],   backgroundColor: '#ffca28', stack: 'rh' },
        { label: 'Zaid',          data: [0,0,5,10,5,0,0,0,0,0,0,0],  backgroundColor: '#0288d1', stack: 'z' },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { display: false }, x: { stacked: false } }
    }
  });
}

function initFertChart() {
  const ctx = document.getElementById('fertChart')?.getContext('2d');
  if (!ctx) return;
  state.charts.fert = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Rice','Wheat','Maize','Cotton','Sugarcane','Soybean','Tomato'],
      datasets: [
        { label: 'N (kg/ha)', data: [120,150,180,150,250,30,200], backgroundColor: '#43a047' },
        { label: 'P (kg/ha)', data: [60,60,80,60,80,80,150],      backgroundColor: '#fb8c00' },
        { label: 'K (kg/ha)', data: [60,40,60,60,100,40,150],     backgroundColor: '#1e88e5' },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: false }, y: { title: { display: true, text: 'kg/ha' } } }
    }
  });
}

function initIrrigChart() {
  const ctx = document.getElementById('irrigChart')?.getContext('2d');
  if (!ctx) return;
  state.charts.irrig = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Drip (90–95%)', 'Sprinkler (75–85%)', 'Flood (40–50%)'],
      datasets: [{
        data: [92, 80, 45],
        backgroundColor: ['#43a047','#0288d1','#fb8c00'],
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: { label: (c) => ` ${c.label}: ${c.raw}% efficiency` }
        }
      }
    }
  });
}

function updateMarketChart(data) {
  const ctx = document.getElementById('marketChart')?.getContext('2d');
  if (!ctx) return;
  if (state.charts.market) state.charts.market.destroy();

  const labels = Object.keys(data.msp_kharif || {}).slice(0, 6);
  const prices = labels.map(k => {
    const val = data.msp_kharif[k];
    return parseInt(val.replace(/[^0-9]/g, '')) || 0;
  });

  state.charts.market = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => l.split('(')[0].trim()),
      datasets: [{
        label: 'MSP (₹/quintal)',
        data: prices,
        backgroundColor: labels.map((_, i) => `hsl(${120 + i * 25},55%,45%)`),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          title: { display: true, text: '₹ / quintal' },
          beginAtZero: false,
        }
      }
    }
  });
}

// ─── Toast notifications ───────────────────────────────────────────
function showToast(msg) {
  $('toastBody').textContent = msg;
  const toast = new bootstrap.Toast($('liveToast'), { delay: 3000 });
  toast.show();
}

// ─── Utility ──────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Auto-switch to chat when navigating back to it
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') showPanel('chat', null);
});
