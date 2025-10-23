const messagesEl = document.getElementById('messages');
const startLoopBtn = document.getElementById('startLoop');
const stopLoopBtn = document.getElementById('stopLoop');
const buildArchiveBtn = document.getElementById('buildArchive');
const reloadModelsBtn = document.getElementById('reloadModels');
const agentAProviderSelect = document.getElementById('agentAProvider');
const agentAModelInput = document.getElementById('agentAModel');
const agentBProviderSelect = document.getElementById('agentBProvider');
const agentBModelInput = document.getElementById('agentBModel');
const saveAgentModelsBtn = document.getElementById('saveAgentModels');
const ragInfoEl = document.getElementById('ragInfo');
const ragRetrievalEl = document.getElementById('ragRetrieval');
const agentAEl = document.getElementById('agentA').querySelector('.state');
const agentBEl = document.getElementById('agentB').querySelector('.state');
const agentLights = {
  AI_A: document.querySelector('[data-agent-light="AI_A"]'),
  AI_B: document.querySelector('[data-agent-light="AI_B"]')
};
const agentNames = { AI_A: 'Physicist', AI_B: 'Validator' };
const agentTestButtons = document.querySelectorAll('.test-agent');
const loopStateEl = document.getElementById('loopState');
const loopTurnEl = document.getElementById('loopTurn');
const loopMaxEl = document.getElementById('loopMax');
const starterField = document.getElementById('starterField');
const memoryStatusEl = document.getElementById('memoryStatus');
let starterSaveTimeout;

const LIGHT_STATES = ['ok', 'error', 'unknown', 'checking'];

function setAgentLight(agentKey, { reachable, lastCheck, lastError } = {}) {
  const el = agentLights[agentKey];
  if (!el) return;
  el.classList.remove(...LIGHT_STATES);
  let title = 'Status unknown';
  if (reachable === true) {
    el.classList.add('ok');
    title = lastCheck ? `Reachable (checked ${new Date(lastCheck).toLocaleTimeString()})` : 'Reachable';
  } else if (reachable === false) {
    el.classList.add('error');
    title = lastError || 'Provider unreachable';
  } else {
    el.classList.add('unknown');
  }
  el.setAttribute('title', title);
}

function setAgentLightChecking(agentKey) {
  const el = agentLights[agentKey];
  if (!el) return;
  el.classList.remove(...LIGHT_STATES);
  el.classList.add('checking');
  el.setAttribute('title', 'Checking connectivity…');
}

function setLoopControls(running) {
  if (startLoopBtn) {
    startLoopBtn.disabled = running;
    startLoopBtn.textContent = running ? 'Loop Running…' : 'Start Loop';
  }
  if (stopLoopBtn) {
    stopLoopBtn.disabled = !running;
  }
}

setLoopControls(false);

async function refreshStats() {
  try {
    const stats = await window.TwinLine.getFlowStats();
    if (!stats) return;
    ragInfoEl.textContent = `${stats.chunks} chunks | ${stats.ramUsageMb} / ${stats.capMb} MB used`;
    ragRetrievalEl.textContent = stats.lastRetrieval?.time || '—';
    memoryStatusEl.textContent = stats.archiveActive ? 'Active' : 'Inactive';
  } catch (err) {
    console.error(err);
  }
}

async function refreshAgents() {
  try {
    const agents = await window.TwinLine.getAgentStatus();
    if (!agents) return;
    const agentAText = agents.AI_A?.provider && agents.AI_A?.model
      ? `${agents.AI_A.loaded ? 'Loaded' : 'Idle'} • ${agents.AI_A.provider}/${agents.AI_A.model}`
      : (agents.AI_A?.loaded ? 'Loaded' : 'Idle');
    const agentBText = agents.AI_B?.provider && agents.AI_B?.model
      ? `${agents.AI_B.loaded ? 'Loaded' : 'Idle'} • ${agents.AI_B.provider}/${agents.AI_B.model}`
      : (agents.AI_B?.loaded ? 'Loaded' : 'Idle');
    agentAEl.textContent = agentAText;
    agentBEl.textContent = agentBText;
    setAgentLight('AI_A', agents.AI_A);
    setAgentLight('AI_B', agents.AI_B);
  } catch (err) {
    console.error(err);
  }
}

function ensureOption(selectEl, value) {
  if (!selectEl) return;
  if (!value) return;
  const exists = Array.from(selectEl.options).some((opt) => opt.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  }
  selectEl.value = value;
}

function applyAgentConfig(config) {
  if (!agentAProviderSelect || !agentBProviderSelect) return;
  const agents = config?.agents || {};
  const agentA = agents.AI_A || {};
  const agentB = agents.AI_B || {};
  ensureOption(agentAProviderSelect, agentA.provider || 'lmstudio');
  ensureOption(agentBProviderSelect, agentB.provider || 'ollama');
  agentAModelInput.value = agentA.model || 'chatgpt-oss-20b';
  agentBModelInput.value = agentB.model || 'cogito:3b';
}

async function populateModelControls() {
  try {
    const config = await window.TwinLine.getConfig();
    if (config) {
      applyAgentConfig(config);
    }
  } catch (err) {
    console.error(err);
  }
}

function appendMessage(turn) {
  const container = document.createElement('div');
  container.className = 'message';
  const sender = document.createElement('div');
  sender.className = 'sender';
  sender.textContent = `[${turn.sender}]`;
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = turn.message;
  container.appendChild(sender);
  container.appendChild(content);
  messagesEl.appendChild(container);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

startLoopBtn.addEventListener('click', async () => {
  setLoopControls(true);
  messagesEl.innerHTML = '';
  loopStateEl.textContent = 'Starting…';
  loopTurnEl.textContent = '0';
  try {
    await window.TwinLine.setConversationStarter({ starter: starterField.value });
    await window.TwinLine.startConversation({ starter: starterField.value });
    const status = await window.TwinLine.getConversationStatus();
    loopMaxEl.textContent = status.maxTurns;
    loopStateEl.textContent = 'Running';
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to start loop');
    setLoopControls(false);
  }
});

stopLoopBtn.addEventListener('click', async () => {
  stopLoopBtn.disabled = true;
  loopStateEl.textContent = 'Stopping…';
  try {
    await window.TwinLine.stopConversation();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to stop loop');
    setLoopControls(false);
  }
});

buildArchiveBtn.addEventListener('click', async () => {
  buildArchiveBtn.disabled = true;
  buildArchiveBtn.textContent = 'Building...';
  try {
    const result = await window.TwinLine.buildArchive();
    alert(result.ok ? `Archive ready (${result.chunks} chunks)` : result.message);
  } catch (err) {
    alert(err.message);
  } finally {
    buildArchiveBtn.disabled = false;
    buildArchiveBtn.textContent = 'Build Archive';
    refreshStats();
  }
});

reloadModelsBtn.addEventListener('click', async () => {
  await window.TwinLine.reloadModels();
  refreshAgents();
});

agentTestButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const agentKey = button.dataset.agent;
    if (!agentKey) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Testing…';
    setAgentLightChecking(agentKey);
    try {
      const result = await window.TwinLine.pingAgent(agentKey);
      if (result?.ok) {
        alert(`${agentNames[agentKey] || agentKey} is reachable (status ${result.status}).`);
      } else {
        alert(`Ping failed: ${result?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Ping failed: ${err.message}`);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
      refreshAgents();
    }
  });
});

saveAgentModelsBtn?.addEventListener('click', async () => {
  const agentAProvider = agentAProviderSelect.value;
  const agentAModel = agentAModelInput.value.trim();
  const agentBProvider = agentBProviderSelect.value;
  const agentBModel = agentBModelInput.value.trim();

  if (!agentAModel || !agentBModel) {
    alert('Please provide model identifiers for both agents.');
    return;
  }

  saveAgentModelsBtn.disabled = true;
  const originalLabel = saveAgentModelsBtn.textContent;
  saveAgentModelsBtn.textContent = 'Saving...';

  try {
    const updated = await window.TwinLine.updateConfig({
      agents: {
        AI_A: { provider: agentAProvider, model: agentAModel },
        AI_B: { provider: agentBProvider, model: agentBModel }
      }
    });
    applyAgentConfig(updated);
    refreshAgents();
    alert('Agent models updated. Reload the models to refresh embeddings if needed.');
  } catch (err) {
    console.error(err);
    alert(`Failed to update models: ${err.message}`);
  } finally {
    saveAgentModelsBtn.disabled = false;
    saveAgentModelsBtn.textContent = originalLabel;
  }
});

starterField.addEventListener('input', () => {
  if (starterSaveTimeout) {
    clearTimeout(starterSaveTimeout);
  }
  starterSaveTimeout = setTimeout(() => {
    window.TwinLine.setConversationStarter({ starter: starterField.value });
  }, 400);
});

window.TwinLine.onLoopUpdate((event) => {
  if (event.type === 'new-message') {
    appendMessage(event.payload);
    loopTurnEl.textContent = event.payload.turn_number;
  }
  if (event.type === 'loop-started') {
    loopStateEl.textContent = 'Running';
    loopTurnEl.textContent = event.status.currentTurn;
    loopMaxEl.textContent = event.status.maxTurns;
    setLoopControls(true);
  }
  if (event.type === 'loop-finished' || event.type === 'loop-stopped') {
    loopStateEl.textContent = 'Stopped';
    setLoopControls(false);
  }
  if (event.type === 'loop-error') {
    loopStateEl.textContent = 'Error';
    alert(event.message);
    setLoopControls(false);
  }
});

setInterval(() => {
  refreshStats();
  refreshAgents();
}, 2000);

refreshStats();
refreshAgents();
populateModelControls();
window.TwinLine.getConversationStatus().then((status) => {
  loopMaxEl.textContent = status.maxTurns;
  if (status.starter) {
    starterField.value = status.starter;
  }
  setLoopControls(status.running);
});
