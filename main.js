const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'storage.json');

// FOSSfit 2.0 default schema. Old files without `meditation` still load;
// the renderer merges missing keys from its own defaults.
const DEFAULT_SCHEMA = {
  journey: [],
  food: [],
  medication: [],
  weight: [],
  goals: [],
  meditation: [],
};

// Initialize data directory and file
function initializeData() {
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Created data directory: ${dataDir}`);
    } catch (error) {
      console.error('Error creating data directory:', error.message);
    }
  }

  if (!fs.existsSync(dataFile)) {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(DEFAULT_SCHEMA, null, 2), { mode: 0o644 });
      console.log(`Initialized storage file: ${dataFile}`);
    } catch (error) {
      console.error('Error initializing storage file:', error.message);
    }
  }
}

function loadData() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    // If the file exists but is corrupt, back it up before resetting so
    // no data is silently lost.
    try {
      if (fs.existsSync(dataFile)) {
        const backup = `${dataFile}.corrupt.${Date.now()}`;
        fs.copyFileSync(dataFile, backup);
        console.error(`Corrupt storage backed up to: ${backup}`);
      }
    } catch (backupErr) {
      console.error('Error backing up corrupt storage:', backupErr.message);
    }
    console.error('Error loading data:', error.message);
    return Object.assign({}, DEFAULT_SCHEMA);
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), { mode: 0o644 });
  } catch (error) {
    console.error('Error saving data:', error.message);
  }
}

// --- medication reminders (2.0) ---
// Tracks which (medication, date) pairs have already fired, in memory only.
const notifiedMeds = new Set();

function medDayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Medication entries store content like "Ibuprofen 200mg @ 08:30".
function parseMedTime(content) {
  const m = String(content).match(/@\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: parseInt(m[1], 10), min: parseInt(m[2], 10) };
}

function checkMedicationReminders() {
  if (!Notification.isSupported()) return;
  const data = loadData();
  const meds = Array.isArray(data.medication) ? data.medication : [];
  const now = new Date();
  const dayKey = medDayKey();

  for (const med of meds) {
    const t = parseMedTime(med.content);
    if (!t) continue;
    const key = `${med.id}@${dayKey}`;
    if (notifiedMeds.has(key)) continue;

    // Fire if the scheduled time is within the last 15 minutes.
    const scheduled = new Date(now);
    scheduled.setHours(t.h, t.min, 0, 0);
    const diffMs = now - scheduled;
    if (diffMs >= 0 && diffMs <= 15 * 60 * 1000) {
      notifiedMeds.add(key);
      const name = String(med.content).split('@')[0].trim() || 'Medication';
      try {
        new Notification({
          title: 'FOSSfit — medication reminder',
          body: `Time for: ${name}`,
        }).show();
      } catch (e) {
        console.error('Notification failed:', e.message);
      }
    }
  }
}

function startReminderLoop() {
  checkMedicationReminders(); // on boot
  setInterval(checkMedicationReminders, 15 * 60 * 1000); // every 15 min
}

// IPC handlers
ipcMain.handle('load-data', () => {
  return loadData();
});

ipcMain.handle('save-data', (event, data) => {
  saveData(data);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false, // we disable nodeIntegration for security
      contextIsolation: true, // enables context isolation
      preload: path.join(__dirname, 'preload.js') // includes our preload script
    }
  });
  win.loadFile('index.html');
  // win.webContents.openDevTools(); // uncomment this line for debugging
}

app.whenReady().then(() => {
  initializeData();
  createWindow();
  startReminderLoop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initializeData();
    createWindow();
  }
});
