const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'data', 'storage.json');

// Initialize data file
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({
    journey: [],
    food: [],
    medication: [],
    weight: [],
    goals: []
  }, null, 2), { mode: 0o644 });
}

function loadData() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading data:', error.message);
    return { journey: [], food: [], medication: [], weight: [], goals: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), { mode: 0o644 });
    console.log('Data saved successfully to storage.json');
  } catch (error) {
    console.error('Error saving data:', error.message);
  }
}

function formatTimestamp() {
  return new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function generateId(tabData) {
  return tabData.length > 0 ? Math.max(...tabData.map(item => item.id)) + 1 : 1;
}

function showTab(tabId) {
  console.log(`Showing tab: ${tabId}`);
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  const tabElement = document.getElementById(tabId);
  if (tabElement) {
    tabElement.style.display = 'block';
    if (tabId !== 'about') loadTabData(tabId);
  } else {
    console.error(`Tab ${tabId} not found`);
  }
}

function loadTabData(tabId) {
  console.log(`Loading data for tab: ${tabId}`);
  const data = loadData();
  const list = document.getElementById(`${tabId}-list`);
  if (!list) {
    console.error(`List element for ${tabId} not found`);
    return;
  }
  list.innerHTML = ''; // Clear existing list
  if (data[tabId] && Array.isArray(data[tabId])) {
    data[tabId].forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item';
      const contentSpan = document.createElement('span');
      contentSpan.textContent = `${item.timestamp}: ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}`;
      contentSpan.onclick = () => showEntry(tabId, item.id);
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-button';
      deleteButton.textContent = '×';
      deleteButton.onclick = () => deleteEntry(tabId, item.id);
      div.appendChild(contentSpan);
      div.appendChild(deleteButton);
      list.appendChild(div);
    });
    console.log(`Rendered ${data[tabId].length} items for ${tabId}`);
  } else {
    console.warn(`No data or invalid data for ${tabId}`);
  }
}

function showEntry(tabId, id) {
  console.log(`Showing entry ${id} for tab ${tabId}`);
  const data = loadData();
  const entry = data[tabId].find(item => item.id === id);
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

function deleteEntry(tabId, id) {
  console.log(`Deleting entry ${id} from ${tabId}`);
  const data = loadData();
  if (data[tabId]) {
    data[tabId] = data[tabId].filter(item => item.id !== id);
    saveData(data);
    loadTabData(tabId);
    console.log(`Deleted entry ${id} from ${tabId}`);
  } else {
    console.error(`Tab ${tabId} not found in data`);
  }
}

function closeModal() {
  const modal = document.getElementById('entry-modal');
  if (modal) {
    modal.style.display = 'none';
    console.log('Modal closed');
  } else {
    console.error('Modal element not found');
  }
}

function saveJourney() {
  const input = document.getElementById('journey-entry');
  if (!input) {
    console.error('Journey input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving journey entry:', entry);
    input.value = ''; // Clear input first
    const data = loadData();
    data.journey.push({
      id: generateId(data.journey),
      timestamp: formatTimestamp(),
      content: entry
    });
    saveData(data);
    loadTabData('journey');
    console.log('Journey entry saved and UI updated');
  } else {
    console.warn('Empty journey entry, not saving');
  }
}

function saveFood() {
  const input = document.getElementById('food-entry');
  if (!input) {
    console.error('Food input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving food entry:', entry);
    input.value = ''; // Clear input first
    const data = loadData();
    data.food.push({
      id: generateId(data.food),
      timestamp: formatTimestamp(),
      content: entry
    });
    saveData(data);
    loadTabData('food');
    console.log('Food entry saved and UI updated');
  } else {
    console.warn('Empty food entry, not saving');
  }
}

function saveMedication() {
  const input = document.getElementById('medication-entry');
  const timeInput = document.getElementById('medication-time');
  if (!input || !timeInput) {
    console.error('Medication input or time element not found');
    return;
  }
  const entry = input.value.trim();
  const time = timeInput.value;
  if (entry && time) {
    console.log('Saving medication entry:', entry, time);
    input.value = ''; // Clear inputs first
    timeInput.value = '';
    const data = loadData();
    data.medication.push({
      id: generateId(data.medication),
      timestamp: `${formatTimestamp().split(',')[0]} ${time}`,
      content: entry
    });
    saveData(data);
    loadTabData('medication');
    console.log('Medication entry saved and UI updated');
  } else {
    console.warn('Empty medication entry or time, not saving');
  }
}

function saveWeight() {
  const input = document.getElementById('weight-entry');
  if (!input) {
    console.error('Weight input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving weight entry:', entry);
    input.value = ''; // Clear input first
    const data = loadData();
    data.weight.push({
      id: generateId(data.weight),
      timestamp: formatTimestamp(),
      content: `${entry} kg`
    });
    saveData(data);
    loadTabData('weight');
    console.log('Weight entry saved and UI updated');
  } else {
    console.warn('Empty weight entry, not saving');
  }
}

function saveGoal() {
  const input = document.getElementById('goal-entry');
  if (!input) {
    console.error('Goal input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving goal entry:', entry);
    input.value = ''; // Clear input first
    const data = loadData();
    data.goals.push({
      id: generateId(data.goals),
      timestamp: formatTimestamp(),
      content: entry
    });
    saveData(data);
    loadTabData('goals');
    console.log('Goal entry saved and UI updated');
  } else {
    console.warn('Empty goal entry, not saving');
  }
}

// Load initial tab
showTab('journey');
