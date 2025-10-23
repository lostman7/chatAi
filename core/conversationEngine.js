const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { getConfig } = require('./settings');
const { AGENTS, sendMessage } = require('./agentManager');
const { retrieveContext } = require('./ragService');

let loopRunning = false;
let currentTurn = 0;
let conversationHistory = [];
let conversationStarter = '';
let conversationLogPath = null;
let reasoningLoggerRef = null;

function setConversationStarter(text) {
  conversationStarter = text || '';
}

function broadcast(update) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('loop:update', update);
  });
}

function getLoopStatus() {
  return {
    running: loopRunning,
    currentTurn,
    maxTurns: getConfig().max_turns,
    starter: conversationStarter
  };
}

async function startConversationLoop(reasoningLogger) {
  if (loopRunning) {
    return { alreadyRunning: true, status: getLoopStatus() };
  }
  const config = getConfig();
  loopRunning = true;
  currentTurn = 0;
  conversationHistory = [];
  reasoningLoggerRef = reasoningLogger;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  conversationLogPath = path.join(__dirname, `../logs/conversations/session_${timestamp}.jsonl`);

  broadcast({ type: 'loop-started', status: getLoopStatus() });
  runLoop(config).catch((err) => {
    console.error('Conversation loop error', err);
    broadcast({ type: 'loop-error', message: err.message });
    loopRunning = false;
  });
  return { started: true, status: getLoopStatus() };
}

async function stopConversationLoop() {
  loopRunning = false;
  broadcast({ type: 'loop-stopped' });
  return { stopped: true };
}

async function runLoop(config) {
  while (loopRunning && currentTurn < config.max_turns) {
    const agentKey = currentTurn % 2 === 0 ? 'AI_A' : 'AI_B';
    const agent = AGENTS[agentKey];
    const querySource = conversationHistory.length
      ? conversationHistory[conversationHistory.length - 1].message
      : conversationStarter;
    let retrieved = [];
    try {
      retrieved = await retrieveContext(querySource, config.rag_top_k);
    } catch (err) {
      console.warn('Context retrieval failed', err.message);
    }
    const contextText = retrieved.map((chunk, index) => `[[${index + 1}]] ${chunk.content}`).join('\n\n');

    const messages = [
      { role: 'system', content: agent.system_prompt }
    ];

    if (contextText) {
      messages.push({
        role: 'system',
        content: `Relevant context from FlowChunker (Top ${retrieved.length}):\n${contextText}`
      });
    }

    if (conversationStarter && conversationHistory.length === 0) {
      messages.push({ role: 'user', content: conversationStarter });
    }

    for (const turn of conversationHistory) {
      messages.push({
        role: turn.agent === agentKey ? 'assistant' : 'user',
        content: turn.message
      });
    }

    const reasoningTrace = [
      `Retrieve FlowChunker context (${retrieved.length} items)`,
      `Compose response as ${agent.name}`
    ];

    let responseText = '';
    try {
      responseText = await sendMessage(agentKey, messages);
    } catch (err) {
      responseText = `Error contacting provider: ${err.message}`;
      console.error(err);
    }

    const turnRecord = {
      turn_number: currentTurn + 1,
      sender: agent.name,
      agent: agentKey,
      message: responseText,
      reasoning_trace: reasoningTrace,
      context_used: retrieved.map((chunk) => ({ id: chunk.id, source: chunk.source, score: chunk.score })),
      retrievals: retrieved
    };

    conversationHistory.push({ agent: agentKey, message: responseText });

    if (reasoningLoggerRef) {
      reasoningLoggerRef.log({
        turn: turnRecord.turn_number,
        agent: agent.name,
        intent: reasoningTrace[1],
        chain: reasoningTrace,
        result: responseText.slice(0, 280)
      });
    }

    fs.appendFileSync(conversationLogPath, JSON.stringify(turnRecord) + '\n');

    broadcast({ type: 'new-message', payload: turnRecord });

    currentTurn += 1;
    if (!loopRunning || currentTurn >= config.max_turns) break;
    await new Promise((resolve) => setTimeout(resolve, config.delay_ms));
  }
  loopRunning = false;
  broadcast({ type: 'loop-finished' });
}

module.exports = {
  startConversationLoop,
  stopConversationLoop,
  getLoopStatus,
  setConversationStarter
};
