/* ================================================================
   app.js — Smart Farming Advisor
   IBM watsonx.ai + Granite | Full Frontend Logic
   ----------------------------------------------------------------
   Quality-improved version:
   - Centralized, timeout-aware fetch helper with visible error states
     (nothing gets stuck on a spinner forever anymore)
   - HTML-escaping everywhere dynamic text is inserted (chat replies,
     server data) to prevent XSS / broken markup
   - Dynamically generated buttons use data-attributes + event
     delegation instead of string-interpolated onclick="..." — so a
     crop/scheme name containing a quote can never break the page
   - Defensive localStorage access (Safari private mode etc. can throw)
   - A more robust markdown-ish formatter for chat messages
   - Light debouncing on repeat-click actions (weather refresh/search)
   Public API (functions referenced from index.html) is unchanged:
   showSection, sendMessage, sendQuickQ, handleChatKey, autoResizeTextarea,
   clearChat, exportChat, toggleVoiceInput, updateContext,
   sendContextMessage, refreshWeather, loadWeather, askAIPest
================================================================ */

'use strict';

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════
const API = {
  dashboard:    (crop) => `/api/dashboard?crop=${encodeURIComponent(crop)}`,
  weather:      (city) => `/api/weather?city=${encodeURIComponent(city)}`,
  mandi:        '/api/mandi',
  schemes:      '/api/schemes',
  pests:        '/api/pests',
  chat:         '/api/chat',
  quickAdvice:  '/api/quick-advice',
  clearChat:    '/api/clear-chat',
};

const FETCH_TIMEOUT_MS = 12000;

// ── Global State ──────────────────────────────────────────────
const state = {
  currentSection: 'dashboard',
  selectedCrop:   'wheat',
  city:           'Delhi',
  isTyping:       false,
  recognition:    null,
  voiceActive:    false,
  messageCount:   0,
};

// ── Crop Emoji Map ────────────────────────────────────────────
const CROP_EMOJI = {
  wheat: '🌾', rice: '🍚', maize: '🌽', cotton: '🌿',
  tomato: '🍅', potato: '🥔', onion: '🧅', soybean: '🫘',
};

const TREND_ICON = {
  rising:   '<i class="bi bi-arrow-up-circle-fill trend-rising"></i>',
  falling:  '<i class="bi bi-arrow-down-circle-fill trend-falling"></i>',
  stable:   '<i class="bi bi-dash-circle-fill trend-stable"></i>',
  volatile: '<i class="bi bi-exclamation-circle-fill trend-volatile"></i>',
};

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

/** Escape a value for safe use in innerHTML text content OR as a
 *  quoted HTML attribute (covers & < > " '). Always use this before
 *  interpolating any server- or user-derived string into markup. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function debounce(fn, wait = 400) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start     = parseInt(el.textContent, 10) || 0;
  const duration  = 800;
  const startTime = performance.now();

  function update(ts) {
    const elapsed  = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value    = Math.round(start + (target - start) * easeOut(progress));
    el.textContent = value;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('mainToast');
  const body  = document.getElementById('toastMessage');
  if (!toast || !body) return;

  body.textContent = message;
  toast.className  = `toast align-items-center border-0 toast-${type}`;

  if (window.bootstrap?.Toast) {
    const bsToast = bootstrap.Toast.getOrCreateInstance(toast, { delay: 3000 });
    bsToast.show();
  }
}

/** Renders a compact "something went wrong" state with a Retry button
 *  inside any container, instead of leaving a spinner forever. */
function renderError(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="text-center text-muted py-3">
      <i class="bi bi-exclamation-triangle-fill d-block mb-2" style="font-size:1.4rem;color:var(--red)"></i>
      <div class="small mb-2">${escapeHtml(message)}</div>
    </div>
  `;
  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-success-custom btn-sm d-block mx-auto';
    btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Retry';
    btn.addEventListener('click', onRetry);
    container.querySelector('.text-center')?.appendChild(btn);
  }
}

// ══════════════════════════════════════════════════════════════
// NETWORK — fetchJSON with timeout + consistent error handling
// ══════════════════════════════════════════════════════════════
async function fetchJSON(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ══════════════════════════════════════════════════════════════
// SAFE LOCALSTORAGE (can throw in private/incognito modes)
// ══════════════════════════════════════════════════════════════
function safeGetItem(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — silently ignore, theme just won't persist */
  }
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCropChips();
  setupGlobalClickDelegation();
  loadDashboard();
  loadWeatherSilent();
  loadMandiPrices();
  loadSchemes();
  loadPestGuide();
  loadAITip();
  setupDarkModeToggle();
  setupNavHighlight();
});

/** One delegated listener handles every dynamically generated button
 *  (data-quick-q). This avoids ever building onclick="...('...')"
 *  strings out of interpolated data, which is both an XSS risk and
 *  breaks outright if the text contains a quote character. */
function setupGlobalClickDelegation() {
  document.addEventListener('click', (e) => {
    const quickQBtn = e.target.closest('[data-quick-q]');
    if (quickQBtn) {
      sendQuickQ(quickQBtn.dataset.quickQ);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// THEME (DARK MODE)
// ══════════════════════════════════════════════════════════════
function initTheme() {
  const saved = safeGetItem('theme', 'light');
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  safeSetItem('theme', theme);
  document.querySelectorAll('#darkModeToggle i, #darkModeToggleMobile i').forEach(icon => {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  });
}

function setupDarkModeToggle() {
  ['darkModeToggle', 'darkModeToggleMobile'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION NAVIGATION
// ══════════════════════════════════════════════════════════════
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  state.currentSection = name;

  const hero = document.getElementById('heroBanner');
  const fab  = document.getElementById('fabChat');
  if (hero) hero.style.display = name === 'dashboard' ? '' : 'none';
  if (fab)  fab.style.display  = name === 'chat' ? 'none' : 'flex';

  highlightNav(name);

  const navCollapse = document.getElementById('navbarMenu');
  if (navCollapse?.classList.contains('show') && window.bootstrap?.Collapse) {
    bootstrap.Collapse.getInstance(navCollapse)?.hide();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupNavHighlight() {
  highlightNav('dashboard');
}

function highlightNav(name) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const onclickAttr = link.getAttribute('onclick') || '';
    link.classList.toggle('active', onclickAttr.includes(`'${name}'`));
  });
}

// ══════════════════════════════════════════════════════════════
// CROP CHIPS
// ══════════════════════════════════════════════════════════════
function initCropChips() {
  const crops = ['wheat', 'rice', 'maize', 'cotton', 'tomato', 'potato', 'onion', 'soybean'];
  const container = document.getElementById('cropChips');
  if (!container) return;

  container.innerHTML = '';
  crops.forEach(crop => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `crop-chip ${crop === state.selectedCrop ? 'active' : ''}`;
    btn.dataset.crop = crop;
    btn.innerHTML = `${CROP_EMOJI[crop] || '🌱'} ${capitalize(crop)}`;
    btn.addEventListener('click', () => selectCrop(crop));
    container.appendChild(btn);
  });
}

function selectCrop(crop) {
  state.selectedCrop = crop;

  // Reliable active-state toggling via data-crop, not fragile text matching
  document.querySelectorAll('.crop-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.crop === crop);
  });

  const ctxCrop = document.getElementById('contextCrop');
  if (ctxCrop) ctxCrop.value = crop;

  const badge = document.getElementById('currentCropBadge');
  if (badge) badge.textContent = capitalize(crop);

  loadDashboard();
  showToast(`${CROP_EMOJI[crop] || '🌱'} Switched to ${capitalize(crop)}`, 'success');
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const data = await fetchJSON(API.dashboard(state.selectedCrop));
    renderDashboard(data);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Could not load dashboard data. Retrying may help.', 'error');
  }
}

function renderDashboard(data) {
  animateNumber('soilScore', data.soil_health_score ?? 74);
  animateNumber('cropScore', data.crop_health_score ?? 81);

  const tempEl = document.getElementById('tempVal');
  const humEl  = document.getElementById('humidityVal');
  if (tempEl && data.weather) {
    tempEl.textContent = data.weather.temp ?? '--';
    const tempSub = document.getElementById('tempSub');
    if (tempSub) tempSub.textContent = data.weather.description ?? '';
  }
  if (humEl && data.weather) {
    humEl.textContent = data.weather.humidity ?? '--';
    const humSub = document.getElementById('humiditySub');
    if (humSub) humSub.textContent = 'Relative humidity';
  }

  // Crop Info
  const cropBody = document.getElementById('cropInfoBody');
  if (cropBody && data.crop_info) {
    const ci = data.crop_info;
    const cropName = escapeHtml(data.crop);
    cropBody.innerHTML = `
      <ul class="info-list">
        <li><i class="bi bi-calendar-check-fill"></i><span><strong>Season:</strong> ${escapeHtml(ci.season)}</span></li>
        <li><i class="bi bi-seed-fill" style="color:var(--green-1)"></i><span><strong>Sowing:</strong> ${escapeHtml(ci.sow)}</span></li>
        <li><i class="bi bi-basket-fill" style="color:var(--accent-2)"></i><span><strong>Harvest:</strong> ${escapeHtml(ci.harvest)}</span></li>
        <li><i class="bi bi-droplet-half" style="color:var(--blue)"></i><span><strong>Water:</strong> ${escapeHtml(ci.water)}</span></li>
      </ul>
      <button type="button" class="btn btn-success-custom btn-sm w-100 mt-3"
        data-quick-q="Give me complete cultivation guide for ${escapeHtml(cropName)}">
        <i class="bi bi-robot me-1"></i> Get AI Advice for ${cropName}
      </button>
    `;
  }

  // Mandi
  const mandiEl = document.getElementById('mandiBody');
  if (mandiEl && data.mandi) {
    const m = data.mandi;
    const trendClass = `trend-${m.trend || 'stable'}`;
    mandiEl.innerHTML = `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span style="font-size:2rem;font-weight:700;color:var(--accent)">${escapeHtml(m.price)}</span>
          ${TREND_ICON[m.trend] || ''}
        </div>
        <div class="text-muted small">Per quintal (MSP/Mandi)</div>
      </div>
      <ul class="info-list">
        <li><i class="bi bi-graph-up"></i><span class="${trendClass}"><strong>Trend:</strong> ${escapeHtml(capitalize(m.trend))}</span></li>
        <li><i class="bi bi-geo-alt-fill"></i><span><strong>Best Markets:</strong> ${escapeHtml(m.best_market)}</span></li>
      </ul>
      <button type="button" class="btn btn-success-custom btn-sm w-100 mt-3" onclick="showSection('mandi')">
        <i class="bi bi-table me-1"></i> View All Prices
      </button>
    `;
  }

  // Weather Advisory
  const weatherEl = document.getElementById('weatherBody');
  if (weatherEl && data.weather) {
    const w = data.weather;
    weatherEl.innerHTML = `
      <div class="d-flex align-items-center gap-3 mb-3">
        <div>
          <div style="font-size:1.8rem;font-weight:700;color:var(--accent)">${escapeHtml(w.temp)}</div>
          <div class="text-muted small">${escapeHtml(w.description)}</div>
        </div>
        <div class="vr"></div>
        <div>
          <div class="text-muted small"><i class="bi bi-droplet-fill me-1 text-primary"></i>${escapeHtml(w.humidity)} humidity</div>
          <div class="text-muted small mt-1"><i class="bi bi-wind me-1"></i>${escapeHtml(w.wind)}</div>
        </div>
      </div>
      <div class="ai-tip-card">
        <div class="tip-header"><i class="bi bi-info-circle-fill"></i> Advisory</div>
        ${escapeHtml(w.farming_advisory)}
      </div>
      <button type="button" class="btn btn-success-custom btn-sm w-100 mt-3" onclick="showSection('weather')">
        <i class="bi bi-cloud-sun me-1"></i> Full Weather Details
      </button>
    `;
  }

  // Seasonal Tips
  const tipsEl   = document.getElementById('seasonalTipsBody');
  const seasonEl = document.getElementById('seasonBadge');
  if (tipsEl && Array.isArray(data.seasonal_tips)) {
    if (seasonEl) seasonEl.textContent = data.season ?? '';
    tipsEl.innerHTML = `<ul class="info-list">
      ${data.seasonal_tips.map(tip => `<li><i class="bi bi-check-circle-fill"></i><span>${escapeHtml(tip)}</span></li>`).join('')}
    </ul>`;
  }

  // Schemes Preview
  const schemesEl = document.getElementById('schemesPreviewBody');
  if (schemesEl && Array.isArray(data.govt_schemes)) {
    schemesEl.innerHTML = `
      <ul class="info-list">
        ${data.govt_schemes.map(s => `
          <li>
            <i class="bi bi-bank-fill" style="color:var(--accent)"></i>
            <span><strong>${escapeHtml(s.name)}:</strong> ${escapeHtml(s.benefit)}</span>
          </li>
        `).join('')}
      </ul>
      <button type="button" class="btn btn-success-custom btn-sm w-100 mt-3" onclick="showSection('schemes')">
        <i class="bi bi-list-check me-1"></i> View All Schemes
      </button>
    `;
  }
}

// ══════════════════════════════════════════════════════════════
// WEATHER
// ══════════════════════════════════════════════════════════════
async function loadWeatherSilent() {
  const city = document.getElementById('cityInput')?.value || 'Delhi';
  state.city = city;
  try {
    const data = await fetchJSON(API.weather(city));
    renderWeatherSection(data);
  } catch (err) {
    console.error('Weather error:', err);
  }
}

async function loadWeather() {
  const city = document.getElementById('weatherCitySearch')?.value.trim() || 'Delhi';
  state.city = city;

  const cityInput = document.getElementById('cityInput');
  if (cityInput) cityInput.value = city;

  setWeatherLoading();
  try {
    const data = await fetchJSON(API.weather(city));
    renderWeatherSection(data);
    loadDashboard();
  } catch (err) {
    console.error('Weather error:', err);
    renderError(document.getElementById('weatherAdvisoryBody'), 'Could not load weather. Check the city name and try again.', loadWeather);
    const card = document.getElementById('weatherMainCard');
    if (card) card.innerHTML = `<div class="text-center text-white-50 small py-4">Weather unavailable</div>`;
    showToast('Error loading weather. Check city name.', 'error');
  }
}

const refreshWeather = debounce(async function refreshWeatherImpl() {
  const city = document.getElementById('cityInput')?.value.trim() || 'Delhi';
  state.city = city;
  const weatherSearch = document.getElementById('weatherCitySearch');
  if (weatherSearch) weatherSearch.value = city;
  await loadWeatherSilent();
  showToast(`Weather updated for ${city}`, 'success');
}, 500);

function setWeatherLoading() {
  const card = document.getElementById('weatherMainCard');
  const adv  = document.getElementById('weatherAdvisoryBody');
  if (card) card.innerHTML = `<div class="spinner-custom"><div class="spinner-border text-white"></div></div>`;
  if (adv)  adv.innerHTML  = `<div class="spinner-custom"><div class="spinner-border text-success"></div></div>`;
}

function renderWeatherSection(data) {
  const card = document.getElementById('weatherMainCard');
  const adv  = document.getElementById('weatherAdvisoryBody');
  const upd  = document.getElementById('weatherUpdatedAt');

  if (upd) upd.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

  if (card) {
    card.innerHTML = `
      <div class="weather-temp">${escapeHtml(data.temp)}</div>
      <div class="weather-desc"><i class="bi bi-cloud-sun me-2"></i>${escapeHtml(data.description)}</div>
      <div class="weather-detail">
        <div class="weather-detail-item"><i class="bi bi-droplet-fill"></i>${escapeHtml(data.humidity)}</div>
        <div class="weather-detail-item"><i class="bi bi-wind"></i>${escapeHtml(data.wind)}</div>
      </div>
      <div style="font-size:0.85rem;opacity:0.8;margin-top:8px;">
        <i class="bi bi-geo-alt-fill me-1"></i>${escapeHtml(data.city)}
      </div>
      ${data.note ? `<div style="font-size:0.7rem;opacity:0.6;margin-top:6px;background:rgba(0,0,0,0.1);padding:4px 8px;border-radius:6px;">${escapeHtml(data.note)}</div>` : ''}
    `;
  }

  if (adv) {
    const quickQ = `What farming activities should I do today based on ${data.temp} temperature and ${data.humidity} humidity?`;
    adv.innerHTML = `
      <div class="ai-tip-card mb-3">
        <div class="tip-header"><i class="bi bi-robot"></i> AI Advisory</div>
        <p class="mb-0">${escapeHtml(data.farming_advisory)}</p>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <div class="tip-card tip-blue text-center">
            <i class="bi bi-thermometer-half d-block mb-1"></i>
            <strong>${escapeHtml(data.temp)}</strong><br><small>Temperature</small>
          </div>
        </div>
        <div class="col-6">
          <div class="tip-card tip-green text-center">
            <i class="bi bi-droplet-fill d-block mb-1"></i>
            <strong>${escapeHtml(data.humidity)}</strong><br><small>Humidity</small>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <button type="button" class="btn btn-success-custom btn-sm" data-quick-q="${escapeHtml(quickQ)}">
          <i class="bi bi-robot me-1"></i> Ask AI for Today's Tasks
        </button>
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════════
// MANDI PRICES
// ══════════════════════════════════════════════════════════════
async function loadMandiPrices() {
  const container = document.getElementById('mandiTableContainer');
  try {
    const data = await fetchJSON(API.mandi);
    renderMandiTable(data);
  } catch (err) {
    console.error('Mandi error:', err);
    renderError(container, 'Could not load mandi prices.', loadMandiPrices);
  }
}

function renderMandiTable(data) {
  const container = document.getElementById('mandiTableContainer');
  if (!container) return;

  const rows = Object.entries(data).map(([crop, info]) => {
    const quickQ = `What is the best strategy to sell ${crop} crop? Current price is ${info.price}`;
    return `
      <tr>
        <td><span class="me-2">${CROP_EMOJI[crop] || '🌱'}</span>${escapeHtml(capitalize(crop))}</td>
        <td><strong>${escapeHtml(info.price)}</strong></td>
        <td>${TREND_ICON[info.trend] || ''} <span class="trend-${escapeHtml(info.trend)}">${escapeHtml(capitalize(info.trend))}</span></td>
        <td>${escapeHtml(info.best_market)}</td>
        <td>
          <button type="button" class="btn btn-success-custom btn-sm" data-quick-q="${escapeHtml(quickQ)}">
            <i class="bi bi-robot"></i> Advice
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="mandi-table">
      <thead>
        <tr>
          <th>Crop</th>
          <th>Price (per quintal)</th>
          <th>Trend</th>
          <th>Best Market</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ══════════════════════════════════════════════════════════════
// GOVERNMENT SCHEMES
// ══════════════════════════════════════════════════════════════
async function loadSchemes() {
  const grid = document.getElementById('schemesGrid');
  try {
    const data = await fetchJSON(API.schemes);
    renderSchemes(data.schemes || []);
  } catch (err) {
    console.error('Schemes error:', err);
    renderError(grid, 'Could not load government schemes.', loadSchemes);
  }
}

function renderSchemes(schemes) {
  const grid = document.getElementById('schemesGrid');
  if (!grid) return;

  const schemeIcons = ['bank', 'shield-check', 'clipboard-check', 'droplet', 'phone', 'credit-card', 'building', 'leaf'];

  grid.innerHTML = schemes.map((s, i) => {
    const quickQ = `Tell me everything about ${s.name} scheme — eligibility, how to apply, and documents needed`;
    return `
      <div class="col-md-6 col-lg-4 fade-in" style="animation-delay:${i * 0.08}s">
        <div class="scheme-card">
          <div class="d-flex align-items-start gap-3">
            <div style="width:40px;height:40px;background:var(--accent-light);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="bi bi-${schemeIcons[i % schemeIcons.length]}" style="color:var(--accent);font-size:1.1rem;"></i>
            </div>
            <div>
              <h6>${escapeHtml(s.name)}</h6>
              <p>${escapeHtml(s.benefit)}</p>
              <button type="button" class="btn btn-success-custom btn-sm mt-2" data-quick-q="${escapeHtml(quickQ)}">
                <i class="bi bi-robot me-1"></i> Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// PEST GUIDE
// ══════════════════════════════════════════════════════════════
async function loadPestGuide() {
  const grid = document.getElementById('pestGrid');
  try {
    const data = await fetchJSON(API.pests);
    renderPestGuide(data);
  } catch (err) {
    console.error('Pest guide error:', err);
    renderError(grid, 'Could not load the pest guide.', loadPestGuide);
  }
}

function renderPestGuide(data) {
  const grid = document.getElementById('pestGrid');
  if (!grid) return;

  grid.innerHTML = Object.entries(data).map(([pest, info], i) => {
    const quickQ = `How to treat ${pest} in ${info.crop} crop? Explain organic and chemical methods with application schedule`;
    return `
      <div class="col-md-6 col-lg-4 fade-in" style="animation-delay:${i * 0.08}s">
        <div class="pest-card">
          <h6><i class="bi bi-bug-fill me-2"></i>${escapeHtml(capitalize(pest))}</h6>
          <p class="text-muted small mb-2"><i class="bi bi-flower2 me-1"></i>Affects: ${escapeHtml(info.crop)}</p>
          <div class="d-flex flex-column gap-1 mb-3">
            <div class="d-flex align-items-start gap-2">
              <span class="badge-organic mt-1">ORGANIC</span>
              <span class="small">${escapeHtml(info.organic)}</span>
            </div>
            <div class="d-flex align-items-start gap-2">
              <span class="badge-chemical mt-1">CHEMICAL</span>
              <span class="small">${escapeHtml(info.chemical)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-success-custom btn-sm w-100" data-quick-q="${escapeHtml(quickQ)}">
            <i class="bi bi-robot me-1"></i> Full Treatment Guide
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function askAIPest() {
  const query = document.getElementById('pestSearch')?.value.trim();
  if (!query) {
    showToast('Please describe the pest or symptoms first', 'error');
    return;
  }
  sendQuickQ(`I see these symptoms on my crop: "${query}". What pest or disease is this? How should I treat it?`);
}

// ══════════════════════════════════════════════════════════════
// AI TIP (SIDEBAR)
// ══════════════════════════════════════════════════════════════
async function loadAITip() {
  const el = document.getElementById('aiTipBody');
  if (!el) return;
  try {
    const data = await fetchJSON(API.quickAdvice, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'irrigation efficiency', crop: state.selectedCrop, location: 'India' }),
    });
    el.innerHTML = `
      <div class="ai-tip-card">
        <div class="tip-header"><i class="bi bi-lightbulb-fill"></i> Today's AI Tip</div>
        ${formatMessageText(data.advice || 'No tip available right now.')}
      </div>
    `;
  } catch (err) {
    console.error('AI tip error:', err);
    el.innerHTML = `<p class="text-muted small">AI tips are temporarily unavailable.</p>`;
  }
}

// ══════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════
async function sendMessage() {
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  if (!input || !sendBtn) return;

  const message = input.value.trim();
  if (!message || state.isTyping) return;

  appendMessage('user', message);
  input.value = '';
  autoResizeTextarea(input);

  if (state.messageCount === 0) {
    const qq = document.getElementById('quickQuestions');
    if (qq) qq.style.display = 'none';
  }
  state.messageCount++;

  state.isTyping = true;
  sendBtn.disabled = true;
  const typingId = showTypingIndicator();

  try {
    const data = await fetchJSON(API.chat, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message }),
    });
    removeTypingIndicator(typingId);
    appendMessage('bot', data.reply, data.timestamp);
  } catch (err) {
    console.error('Chat error:', err);
    removeTypingIndicator(typingId);
    appendMessage('bot', '❌ Network error. Please check your connection and try again.');
  } finally {
    state.isTyping = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function sendQuickQ(text) {
  if (!text) return;
  showSection('chat');
  setTimeout(() => {
    const input = document.getElementById('chatInput');
    if (input) {
      input.value = text;
      sendMessage();
    }
  }, 300);
}

function handleChatKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function appendMessage(role, text, time) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const isUser  = role === 'user';
  const timeStr = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div     = document.createElement('div');
  div.className = `message message-${role} fade-slide-up`;

  div.innerHTML = `
    <div class="message-avatar">
      <i class="bi bi-${isUser ? 'person-fill' : 'robot'}"></i>
    </div>
    <div class="message-content">
      <div class="message-bubble">${formatMessageText(text)}</div>
      <div class="message-time">${escapeHtml(timeStr)}</div>
    </div>
  `;

  container.appendChild(div);
  scrollToBottom(container);
}

/** Converts a small markdown subset (bold, italic, inline code,
 *  bullet/numbered lists, paragraphs) to safe HTML. The source text is
 *  escaped FIRST, so any HTML/script the text happens to contain is
 *  neutralized before the markdown tags are added. */
function formatMessageText(text) {
  if (!text) return '';

  const escaped = escapeHtml(text);
  const blocks = escaped.split(/\n{2,}/);

  return blocks.map(block => {
    const lines = block.split('\n');
    const isList = lines.every(line => /^\s*(?:[*\-]|\d+\.)\s+/.test(line.trim()) || line.trim() === '');

    const inline = (s) => s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    if (isList) {
      const items = lines
        .filter(line => line.trim() !== '')
        .map(line => `<li>${inline(line.replace(/^\s*(?:[*\-]|\d+\.)\s+/, ''))}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message message-bot fade-slide-up';
  div.innerHTML = `
    <div class="message-avatar"><i class="bi bi-robot"></i></div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom(container);
  return id;
}

function removeTypingIndicator(id) {
  if (id) document.getElementById(id)?.remove();
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

async function clearChat() {
  try {
    await fetchJSON(API.clearChat, { method: 'POST' });
  } catch (err) {
    console.error('Clear chat error:', err);
    // Still clear the UI locally even if the server call failed
  }

  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = `
      <div class="message message-bot fade-slide-up">
        <div class="message-avatar"><i class="bi bi-robot"></i></div>
        <div class="message-content">
          <div class="message-bubble">
            <p>🌾 Chat cleared! I'm ready for your next farming question.</p>
            <p class="mb-0">How can I help you today?</p>
          </div>
          <div class="message-time">Just now</div>
        </div>
      </div>
    `;
  }
  state.messageCount = 0;
  const qq = document.getElementById('quickQuestions');
  if (qq) qq.style.display = '';
  showToast('Chat history cleared', 'success');
}

function exportChat() {
  const messages = document.querySelectorAll('.message');
  let text = `KrishiBot Chat Export — ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;

  messages.forEach(msg => {
    const role    = msg.classList.contains('message-user') ? 'You' : 'KrishiBot';
    const content = msg.querySelector('.message-bubble')?.innerText || '';
    const time    = msg.querySelector('.message-time')?.textContent || '';
    text += `[${role}] ${time}\n${content}\n\n`;
  });

  const blob = new Blob([text], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `krishibot-chat-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Chat exported!', 'success');
}

// ══════════════════════════════════════════════════════════════
// CONTEXT PANEL
// ══════════════════════════════════════════════════════════════
function updateContext() {
  const crop = document.getElementById('contextCrop')?.value;
  if (crop) {
    state.selectedCrop = crop;
    selectCrop(crop);
  }
}

function sendContextMessage() {
  const crop     = document.getElementById('contextCrop')?.value || 'wheat';
  const location = document.getElementById('contextLocation')?.value || 'India';
  const soil     = document.getElementById('contextSoil')?.value || 'Loamy';

  const msg = `I'm growing ${crop} in ${location}. My soil type is ${soil}. Give me personalized farming advice including irrigation schedule, fertilizer dosage, common pests to watch for, and current best practices.`;
  sendQuickQ(msg);
}

// ══════════════════════════════════════════════════════════════
// VOICE INPUT
// ══════════════════════════════════════════════════════════════
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Voice input not supported in this browser. Try Chrome.', 'error');
    return;
  }

  const btn = document.getElementById('voiceBtn');
  if (!btn) return;

  if (state.voiceActive && state.recognition) {
    state.recognition.stop();
    state.voiceActive = false;
    btn.classList.remove('voice-active');
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = true;
  state.recognition.lang = 'hi-IN'; // Hindi; change to 'en-IN' for English

  state.recognition.onstart = () => {
    state.voiceActive = true;
    btn.classList.add('voice-active');
    showToast('Listening... Speak now (Hindi/English)', 'success');
  };

  state.recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join('');
    const input = document.getElementById('chatInput');
    if (input) {
      input.value = transcript;
      autoResizeTextarea(input);
    }
  };

  state.recognition.onend = () => {
    state.voiceActive = false;
    btn.classList.remove('voice-active');
  };

  state.recognition.onerror = () => {
    state.voiceActive = false;
    btn.classList.remove('voice-active');
    showToast('Voice input error. Please try again.', 'error');
  };

  state.recognition.start();
}
