const messagesEl = document.getElementById('messages');
const startLoopBtn = document.getElementById('startLoop');
const stopLoopBtn = document.getElementById('stopLoop');
const buildArchiveBtn = document.getElementById('buildArchive');
const reloadModelsBtn = document.getElementById('reloadModels');
const ragInfoEl = document.getElementById('ragInfo');
const ragRetrievalEl = document.getElementById('ragRetrieval');
const agentAEl = document.getElementById('agentA').querySelector('.state');
const agentBEl = document.getElementById('agentB').querySelector('.state');
const loopStateEl = document.getElementById('loopState');
const loopTurnEl = document.getElementById('loopTurn');
const loopMaxEl = document.getElementById('loopMax');
const starterField = document.getElementById('starterField');
const setStarterBtn = document.getElementById('setStarter');
const memoryStatusEl = document.getElementById('memoryStatus');

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
    agentAEl.textContent = agents.AI_A.loaded ? 'Loaded' : 'Idle';
    agentBEl.textContent = agents.AI_B.loaded ? 'Loaded' : 'Idle';
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
  messagesEl.innerHTML = '';
  await window.TwinLine.startConversation({ starter: starterField.value });
  const status = await window.TwinLine.getConversationStatus();
  loopMaxEl.textContent = status.maxTurns;
  loopStateEl.textContent = 'Running';
});

stopLoopBtn.addEventListener('click', async () => {
  await window.TwinLine.stopConversation();
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

setStarterBtn.addEventListener('click', async () => {
  await window.TwinLine.setConversationStarter({ starter: starterField.value });
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
  }
  if (event.type === 'loop-finished' || event.type === 'loop-stopped') {
    loopStateEl.textContent = 'Stopped';
  }
  if (event.type === 'loop-error') {
    loopStateEl.textContent = 'Error';
    alert(event.message);
  }
});

setInterval(() => {
  refreshStats();
  refreshAgents();
}, 2000);

refreshStats();
refreshAgents();
window.TwinLine.getConversationStatus().then((status) => {
  loopMaxEl.textContent = status.maxTurns;
});
