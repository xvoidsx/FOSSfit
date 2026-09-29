// app.js — FOSSfit 2.0 renderer
//
// Changes in 2.0:
//   - saveEntry(): one generic saver replaces 5 copy-pasted functions
//   - cachedData: loaded once at startup, no IPC round-trip per action
//   - Date.now() IDs instead of Math.max(...map()) (spread-limit safe)
//   - debug(): console.log only when localStorage 'fossfit-debug' is set
//   - Weight chart (vanilla canvas), meditation tab with Web Audio drone

'use strict';

// --- debug helper: quiet by default ---
function debug(...args) {
  try {
    if (localStorage.getItem('fossfit-debug')) console.log(...args);
  } catch (e) { /* localStorage may be unavailable */ }
}

// --- module state ---
let cachedData = null; // loaded once at startup

const DEFAULT_DATA = {
  journey: [],
  food: [],
  medication: [],
  weight: [],
  goals: [],
  meditation: [],
};

// --- helpers ---

function formatTimestamp() {
  return new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function generateId() {
  return Date.now();
}

// Inline validation error (not alert()). Shows a message under the input,
// clears on next input.
function showInlineError(inputEl, msg) {
  clearInlineError(inputEl);
  const err = document.createElement('div');
  err.className = 'inline-error';
  err.textContent = msg;
  err.setAttribute('data-inline-error', '1');
  inputEl.insertAdjacentElement('afterend', err);
  const clear = () => clearInlineError(inputEl);
  inputEl.addEventListener('input', clear, { once: true });
}

function clearInlineError(inputEl) {
  const next = inputEl.nextElementSibling;
  if (next && next.getAttribute('data-inline-error')) next.remove();
}

// --- data layer (cached) ---

async function ensureData() {
  if (cachedData) return cachedData;
  try {
    const data = await window.api.loadData();
    cachedData = Object.assign({}, DEFAULT_DATA, data);
    // Guarantee arrays even if stored data is malformed.
    for (const k of Object.keys(DEFAULT_DATA)) {
      if (!Array.isArray(cachedData[k])) cachedData[k] = [];
    }
  } catch (error) {
    console.error('Error loading data:', error.message);
    cachedData = Object.assign({}, DEFAULT_DATA);
  }
  return cachedData;
}

async function persistData() {
  try {
    await window.api.saveData(cachedData);
  } catch (error) {
    console.error('Error saving data:', error.message);
  }
}

// --- tabs ---

function showTab(tabId) {
  debug(`Showing tab: ${tabId}`);
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  // Material 3 nav-bar active pill
  document.querySelectorAll('.nav-bar button').forEach(btn => {
    btn.classList.remove('active');
  });
  const navBtn = document.getElementById(`${tabId}-tab`);
  if (navBtn) navBtn.classList.add('active');
  const tabElement = document.getElementById(tabId);
  if (tabElement) {
    tabElement.style.display = 'block';
    if (tabId === 'weight') {
      loadTabData(tabId).then(() => drawWeightChart());
    } else if (tabId !== 'about' && tabId !== 'meditate') {
      loadTabData(tabId);
    }
  } else {
    console.error(`Tab ${tabId} not found`);
  }
}

async function loadTabData(tabId) {
  debug(`Loading data for tab: ${tabId}`);
  const list = document.getElementById(`${tabId}-list`);
  if (!list) {
    console.error(`List element for ${tabId} not found`);
    return;
  }
  list.innerHTML = '';
  const data = await ensureData();
  const items = data[tabId];
  if (Array.isArray(items)) {
    // Newest first.
    [...items].reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'entry-card';
      div.onclick = () => showEntry(tabId, item.id);
      const timeDiv = document.createElement('div');
      timeDiv.className = 'entry-time';
      timeDiv.textContent = item.timestamp;
      const textDiv = document.createElement('div');
      textDiv.className = 'entry-text';
      const preview = String(item.content).substring(0, 120);
      textDiv.textContent = `${preview}${String(item.content).length > 120 ? '…' : ''}`;
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.textContent = 'Delete';
      deleteButton.style.marginTop = '8px';
      deleteButton.onclick = (e) => { e.stopPropagation(); deleteEntry(tabId, item.id); };
      div.appendChild(timeDiv);
      div.appendChild(textDiv);
      div.appendChild(deleteButton);
      list.appendChild(div);
    });
    debug(`Rendered ${items.length} items for ${tabId}`);
  } else {
    console.warn(`No data or invalid data for ${tabId}`);
  }
}

async function showEntry(tabId, id) {
  debug(`Showing entry ${id} for tab ${tabId}`);
  const data = await ensureData();
  const entry = (data[tabId] || []).find(item => item.id === id);
  if (entry) {
    document.getElementById('modal-timestamp').textContent = `Time: ${entry.timestamp}`;
    document.getElementById('modal-content').textContent = `Content: ${entry.content}`;
    const modal = document.getElementById('entry-modal');
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.error('Modal element not found');
    }
  } else {
    console.error(`Entry with ID ${id} not found in ${tabId}`);
  }
}

async function deleteEntry(tabId, id) {
  debug(`Deleting entry ${id} from ${tabId}`);
  const data = await ensureData();
  if (Array.isArray(data[tabId])) {
    data[tabId] = data[tabId].filter(item => item.id !== id);
    await persistData();
    await loadTabData(tabId);
    if (tabId === 'weight') drawWeightChart();
    debug(`Deleted entry ${id} from ${tabId}`);
  } else {
    console.error(`Tab ${tabId} not found in data`);
  }
}

function closeModal() {
  const modal = document.getElementById('entry-modal');
  if (modal) {
    modal.style.display = 'none';
    debug('Modal closed');
  } else {
    console.error('Modal element not found');
  }
}

// --- generic saver (replaces saveJourney/saveFood/saveMedication/saveWeight/saveGoal) ---
//
// tabId:   key in storage (e.g. 'journey')
// inputIds: array of element IDs to read + clear (e.g. ['journey-entry'])
// opts: {
//   getValue:  () => string        — overrides default (join inputIds values)
//   validate:  (value) => string|null — returns error message or null
//   transform: (entry) => entry    — mutate entry before save (e.g. append ' kg')
//   afterSave: () => void          — e.g. redraw chart
// }
async function saveEntry(tabId, inputIds, opts = {}) {
  const inputs = inputIds.map(id => document.getElementById(id));
  if (inputs.some(el => !el)) {
    console.error(`Input element(s) not found for ${tabId}`);
    return;
  }
  const rawValue = opts.getValue
    ? opts.getValue()
    : inputs.map(el => el.value.trim()).filter(Boolean).join(' ');
  const value = rawValue.trim();

  if (!value) {
    console.warn(`Empty ${tabId} entry, not saving`);
    return;
  }
  if (value.length > 2000) {
    showInlineError(inputs[0], 'Entry is too long (max 2000 characters).');
    return;
  }
  if (opts.validate) {
    const errMsg = opts.validate(value);
    if (errMsg) {
      showInlineError(inputs[0], errMsg);
      return;
    }
  }

  let entry = {
    id: generateId(),
    timestamp: formatTimestamp(),
    content: value,
  };
  if (opts.transform) entry = opts.transform(entry) || entry;

  const data = await ensureData();
  if (!Array.isArray(data[tabId])) data[tabId] = [];
  data[tabId].push(entry);
  await persistData();

  inputs.forEach(el => { el.value = ''; });
  await loadTabData(tabId);
  if (opts.afterSave) opts.afterSave();
  debug(`${tabId} entry saved and UI updated`);
}

// --- weight chart (vanilla canvas, no dependencies) ---

function drawWeightChart() {
  const canvas = document.getElementById('weight-chart');
  if (!canvas || !cachedData) return;
  const entries = (cachedData.weight || [])
    .map(e => {
      // content may be "72.5 kg" or "72.5"
      const n = parseFloat(String(e.content));
      return isNaN(n) ? null : { t: new Date(e.timestamp).getTime() || 0, v: n };
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const statsEl = document.getElementById('weight-stats');
  if (entries.length < 2) {
    ctx.fillStyle = '#55556a';
    ctx.font = '13px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Log at least 2 weights to see your trend.', W / 2, H / 2);
    if (statsEl) statsEl.textContent = '';
    return;
  }

  const vs = entries.map(e => e.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
  if (max === min) { max += 1; min -= 1; } // avoid div-by-zero
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;

  const L = 46, R = 12, T = 14, B = 30; // margins
  const x = i => L + (i / (entries.length - 1)) * (W - L - R);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);

  // Gridlines + y labels.
  ctx.strokeStyle = '#2a2a3a';
  ctx.fillStyle = '#666680';
  ctx.font = '11px Courier New';
  ctx.textAlign = 'right';
  for (let g = 0; g <= 4; g++) {
    const gv = min + (max - min) * (g / 4);
    const gy = y(gv);
    ctx.beginPath();
    ctx.moveTo(L, gy);
    ctx.lineTo(W - R, gy);
    ctx.stroke();
    ctx.fillText(gv.toFixed(1), L - 6, gy + 4);
  }

  // Average line.
  ctx.strokeStyle = '#00ffff';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(L, y(avg));
  ctx.lineTo(W - R, y(avg));
  ctx.stroke();
  ctx.setLineDash([]);

  // Data line.
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  entries.forEach((e, i) => {
    if (i === 0) ctx.moveTo(x(i), y(e.v));
    else ctx.lineTo(x(i), y(e.v));
  });
  ctx.stroke();
  ctx.lineWidth = 1;

  // Points.
  ctx.fillStyle = '#ff10f0';
  entries.forEach((e, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(e.v), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Date labels (first, middle, last).
  ctx.fillStyle = '#666680';
  ctx.textAlign = 'center';
  const fmt = t => t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const mid = Math.floor(entries.length / 2);
  ctx.fillText(fmt(entries[0].t), x(0), H - 10);
  ctx.fillText(fmt(entries[mid].t), x(mid), H - 10);
  ctx.fillText(fmt(entries[entries.length - 1].t), x(entries.length - 1), H - 10);

  if (statsEl) {
    statsEl.textContent =
      `min ${Math.min(...vs).toFixed(1)} kg · max ${Math.max(...vs).toFixed(1)} kg · avg ${avg.toFixed(1)} kg · ${entries.length} entries`;
  }
}

// --- meditation ---

const Meditate = {
  audioCtx: null,
  droneNodes: null,
  timerId: null,
  breathId: null,
  endTime: 0,
  running: false,

  start(minutes) {
    if (this.running) this.stop(false);
    this.running = true;
    const totalMs = minutes * 60 * 1000;
    this.endTime = Date.now() + totalMs;
    document.getElementById('meditate-duration').textContent = String(minutes);
    this._startDrone();
    this._startBreathing();
    this._updateUI(true);
    // Tick the countdown.
    this.timerId = setInterval(() => this._tick(), 500);
    this._tick();
    debug(`Meditation started: ${minutes} min`);
  },

  async stop(completed) {
    if (!this.running) return;
    const minutes = parseInt(document.getElementById('meditate-duration').textContent, 10) || 0;
    this.running = false;
    clearInterval(this.timerId);
    clearTimeout(this.breathId);
    this._stopDrone();
    this._updateUI(false);
    if (completed && minutes > 0) {
      this._chime();
      // Log to meditation array + journey.
      const data = await ensureData();
      const ts = formatTimestamp();
      data.meditation.push({ id: generateId(), timestamp: ts, content: `Meditated for ${minutes} minutes` });
      data.journey.push({ id: generateId(), timestamp: ts, content: `🧘 Meditated for ${minutes} minutes` });
      await persistData();
      document.getElementById('meditate-status').textContent = `Complete — ${minutes} minutes. Logged to your journey.`;
    } else {
      document.getElementById('meditate-status').textContent = 'Session ended.';
    }
  },

  _tick() {
    const remain = Math.max(0, this.endTime - Date.now());
    const m = Math.floor(remain / 60000);
    const s = Math.floor((remain % 60000) / 1000);
    document.getElementById('meditate-timer').textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (remain <= 0) this.stop(true);
  },

  _updateUI(running) {
    document.getElementById('meditate-start-row').style.display = running ? 'none' : 'block';
    document.getElementById('meditate-stop').style.display = running ? 'inline-block' : 'none';
    document.getElementById('meditate-guide').style.display = running ? 'flex' : 'none';
    if (!running) {
      document.getElementById('meditate-timer').textContent = '--:--';
      const circle = document.getElementById('breath-circle');
      if (circle) { circle.style.transition = 'none'; circle.style.transform = 'scale(1)'; }
    } else {
      document.getElementById('meditate-status').textContent = 'Breathe with the circle…';
    }
  },

  _startBreathing() {
    // 4s in, 4s hold, 6s out.
    const circle = document.getElementById('breath-circle');
    const label = document.getElementById('breath-label');
    const phases = [
      { text: 'breathe in…',  scale: 1.6, ms: 4000 },
      { text: 'hold',         scale: 1.6, ms: 4000 },
      { text: 'breathe out…', scale: 1.0, ms: 6000 },
    ];
    let i = 0;
    const runPhase = () => {
      if (!this.running) return;
      const p = phases[i % phases.length];
      label.textContent = p.text;
      circle.style.transition = `transform ${p.ms}ms ease-in-out`;
      // Force reflow so the transition restarts cleanly.
      void circle.offsetWidth;
      circle.style.transform = `scale(${p.scale})`;
      i++;
      this.breathId = setTimeout(runPhase, p.ms);
    };
    runPhase();
  },

  _startDrone() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.audioCtx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
      // Gentle fade in.
      master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 4);

      // Root + fifth + octave + third, slow beating detune for warmth.
      const freqs = [110, 164.81, 220, 277.18]; // A2 E3 A3 C#4
      const oscs = freqs.map((f, idx) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * (1 + (idx % 2 ? 0.0008 : -0.0008));
        const g = ctx.createGain();
        g.gain.value = idx === 0 ? 0.5 : 0.22;
        // Slow LFO on each voice's gain — the "breathing" pad.
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05 + idx * 0.017;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.08;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);
        o.connect(g);
        g.connect(master);
        o.start();
        lfo.start();
        return { o, lfo };
      });
      this.droneNodes = { ctx, master, oscs };
    } catch (e) {
      console.error('Web Audio unavailable:', e.message);
    }
  },

  _stopDrone() {
    if (!this.droneNodes) return;
    const { ctx, master, oscs } = this.droneNodes;
    try {
      master.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 1.5);
      setTimeout(() => {
        oscs.forEach(({ o, lfo }) => { try { o.stop(); lfo.stop(); } catch (e) {} });
        ctx.close();
      }, 1800);
    } catch (e) { /* already closed */ }
    this.droneNodes = null;
    this.audioCtx = null;
  },

  _chime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [523.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = ctx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0, t);
        g.gain.linearRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t);
        o.stop(t + 2.6);
      });
      setTimeout(() => ctx.close(), 4000);
    } catch (e) { /* ignore */ }
  },
};

// --- init ---

document.addEventListener('DOMContentLoaded', async () => {
  debug('DOM loaded, setting up event listeners');

  // Preload data once.
  await ensureData();

  // Tab buttons.
  const tabs = ['journey', 'food', 'medication', 'weight', 'goals', 'meditate', 'about'];
  tabs.forEach(t => {
    const btn = document.getElementById(`${t}-tab`);
    if (btn) btn.addEventListener('click', () => showTab(t));
  });

  // Save buttons — one-liner wiring via the generic saver.
  document.getElementById('journey-save').addEventListener('click', () =>
    saveEntry('journey', ['journey-entry']));
  document.getElementById('food-save').addEventListener('click', () =>
    saveEntry('food', ['food-entry']));
  document.getElementById('medication-save').addEventListener('click', () =>
    saveEntry('medication', ['medication-entry', 'medication-time'], {
      getValue: () => {
        const med = document.getElementById('medication-entry').value.trim();
        const time = document.getElementById('medication-time').value;
        return med && time ? `${med} @ ${time}` : '';
      },
      validate: () => {
        const med = document.getElementById('medication-entry').value.trim();
        const time = document.getElementById('medication-time').value;
        if (!med) return 'Please enter a medication name.';
        if (!time) return 'Please pick a time for this medication.';
        return null;
      },
    }));
  document.getElementById('weight-save').addEventListener('click', () =>
    saveEntry('weight', ['weight-entry'], {
      validate: (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return 'Please enter a number.';
        if (n <= 0) return 'Weight must be positive.';
        if (n < 20 || n > 500) return 'That seems off — enter a weight between 20 and 500 kg.';
        return null;
      },
      transform: (entry) => {
        entry.content = `${parseFloat(entry.content)} kg`;
        return entry;
      },
      afterSave: () => drawWeightChart(),
    }));
  document.getElementById('goal-save').addEventListener('click', () =>
    saveEntry('goals', ['goal-entry']));

  // Modal close.
  document.getElementById('modal-close').addEventListener('click', closeModal);
  // Click outside modal closes it.
  document.getElementById('entry-modal').addEventListener('click', (e) => {
    if (e.target.id === 'entry-modal') closeModal();
  });
  // Escape closes modal.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Meditation presets + stop.
  document.querySelectorAll('[data-meditate-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      Meditate.start(parseInt(btn.getAttribute('data-meditate-minutes'), 10));
    });
  });
  document.getElementById('meditate-stop').addEventListener('click', () => Meditate.stop(false));

  // Load initial tab.
  showTab('journey');
});
