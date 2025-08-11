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

async function loadTabData(tabId) {
  console.log(`Loading data for tab: ${tabId}`);
  const list = document.getElementById(`${tabId}-list`);
  if (!list) {
    console.error(`List element for ${tabId} not found`);
    return;
  }
  list.innerHTML = '';
  try {
    const data = await window.api.loadData();
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
  } catch (error) {
    console.error('Error loading tab data:', error.message);
  }
}

async function showEntry(tabId, id) {
  console.log(`Showing entry ${id} for tab ${tabId}`);
  try {
    const data = await window.api.loadData();
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
  } catch (error) {
    console.error('Error showing entry:', error.message);
  }
}

async function deleteEntry(tabId, id) {
  console.log(`Deleting entry ${id} from ${tabId}`);
  try {
    const data = await window.api.loadData();
    if (data[tabId]) {
      data[tabId] = data[tabId].filter(item => item.id !== id);
      await window.api.saveData(data);
      loadTabData(tabId);
      console.log(`Deleted entry ${id} from ${tabId}`);
    } else {
      console.error(`Tab ${tabId} not found in data`);
    }
  } catch (error) {
    console.error('Error deleting entry:', error.message);
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

async function saveJourney() {
  const input = document.getElementById('journey-entry');
  if (!input) {
    console.error('Journey input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving journey entry:', entry);
    input.value = '';
    try {
      const data = await window.api.loadData();
      data.journey.push({
        id: generateId(data.journey),
        timestamp: formatTimestamp(),
        content: entry
      });
      await window.api.saveData(data);
      loadTabData('journey');
      console.log('Journey entry saved and UI updated');
    } catch (error) {
      console.error('Error saving journey entry:', error.message);
    }
  } else {
    console.warn('Empty journey entry, not saving');
  }
}

async function saveFood() {
  const input = document.getElementById('food-entry');
  if (!input) {
    console.error('Food input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving food entry:', entry);
    input.value = '';
    try {
      const data = await window.api.loadData();
      data.food.push({
        id: generateId(data.food),
        timestamp: formatTimestamp(),
        content: entry
      });
      await window.api.saveData(data);
      loadTabData('food');
      console.log('Food entry saved and UI updated');
    } catch (error) {
      console.error('Error saving food entry:', error.message);
    }
  } else {
    console.warn('Empty food entry, not saving');
  }
}

async function saveMedication() {
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
    input.value = '';
    timeInput.value = '';
    try {
      const data = await window.api.loadData();
      data.medication.push({
        id: generateId(data.medication),
        timestamp: `${formatTimestamp().split(',')[0]} ${time}`,
        content: entry
      });
      await window.api.saveData(data);
      loadTabData('medication');
      console.log('Medication entry saved and UI updated');
    } catch (error) {
      console.error('Error saving medication entry:', error.message);
    }
  } else {
    console.warn('Empty medication entry or time, not saving');
  }
}

async function saveWeight() {
  const input = document.getElementById('weight-entry');
  if (!input) {
    console.error('Weight input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving weight entry:', entry);
    input.value = '';
    try {
      const data = await window.api.loadData();
      data.weight.push({
        id: generateId(data.weight),
        timestamp: formatTimestamp(),
        content: `${entry} kg`
      });
      await window.api.saveData(data);
      loadTabData('weight');
      console.log('Weight entry saved and UI updated');
    } catch (error) {
      console.error('Error saving weight entry:', error.message);
    }
  } else {
    console.warn('Empty weight entry, not saving');
  }
}

async function saveGoal() {
  const input = document.getElementById('goal-entry');
  if (!input) {
    console.error('Goal input element not found');
    return;
  }
  const entry = input.value.trim();
  if (entry) {
    console.log('Saving goal entry:', entry);
    input.value = '';
    try {
      const data = await window.api.loadData();
      data.goals.push({
        id: generateId(data.goals),
        timestamp: formatTimestamp(),
        content: entry
      });
      await window.api.saveData(data);
      loadTabData('goals');
      console.log('Goal entry saved and UI updated');
    } catch (error) {
      console.error('Error saving goal entry:', error.message);
    }
  } else {
    console.warn('Empty goal entry, not saving');
  }
}

// initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up event listeners');
  // tab buttons
  document.getElementById('journey-tab').addEventListener('click', () => showTab('journey'));
  document.getElementById('food-tab').addEventListener('click', () => showTab('food'));
  document.getElementById('medication-tab').addEventListener('click', () => showTab('medication'));
  document.getElementById('weight-tab').addEventListener('click', () => showTab('weight'));
  document.getElementById('goals-tab').addEventListener('click', () => showTab('goals'));
  document.getElementById('about-tab').addEventListener('click', () => showTab('about'));
  // save buttons
  document.getElementById('journey-save').addEventListener('click', saveJourney);
  document.getElementById('food-save').addEventListener('click', saveFood);
  document.getElementById('medication-save').addEventListener('click', saveMedication);
  document.getElementById('weight-save').addEventListener('click', saveWeight);
  document.getElementById('goal-save').addEventListener('click', saveGoal);
  // modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  // load initial tab
  showTab('journey');
});
