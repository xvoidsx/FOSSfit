const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(app.getPath('userData'), 'data');
const dataFile = path.join(dataDir, 'storage.json');

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
      fs.writeFileSync(dataFile, JSON.stringify({
        journey: [],
        food: [],
        medication: [],
        weight: [],
        goals: []
      }, null, 2), { mode: 0o644 });
      console.log(`Initialized storage file: ${dataFile}`);
    } catch (error) {
      console.error('Error initializing storage file:', error.message);
    }
  }
}

function loadData() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    console.log(`Loaded data from: ${dataFile}`);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading data:', error.message);
    return { journey: [], food: [], medication: [], weight: [], goals: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), { mode: 0o644 });
    console.log(`Saved data to: ${dataFile}`);
  } catch (error) {
    console.error('Error saving data:', error.message);
  }
}

// IPC handlers
ipcMain.handle('load-data', () => {
  console.log('IPC: load-data called');
  return loadData();
});

ipcMain.handle('save-data', (event, data) => {
  console.log('IPC: save-data called');
  saveData(data);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
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
