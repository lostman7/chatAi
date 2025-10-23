const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('./settings');

const providers = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/providers.json'), 'utf-8'));

const FALLBACK_DIMENSIONS = 256;

function fallbackEmbeddingVector(text) {
  const vector = new Array(FALLBACK_DIMENSIONS).fill(0);
  if (!text) {
    return vector;
  }
  const tokens = text
    .toLowerCase()
    .match(/[\p{L}\d_-]{2,}/gu);
  if (!tokens || !tokens.length) {
    return vector;
  }
  tokens.forEach((token, tokenIndex) => {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const position = hash % FALLBACK_DIMENSIONS;
    vector[position] += 1 + (tokenIndex % 3) * 0.1;
  });
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

const BASE_AGENTS = {
  AI_A: {
    name: 'Physicist',
    provider: 'lmstudio',
    model: 'chatgpt-oss-20b',
    context_window: 7000,
    role: 'Lead Flowfield theorist and creative system designer.',
    system_prompt: 'You are the lead physicist investigating the Flowfield Hypothesis — develop and refine theories using archived notes, RAG context, and logical synthesis.'
  },
  AI_B: {
    name: 'Validator',
    provider: 'ollama',
    model: 'cogito:3b',
    context_window: 4096,
    role: 'Analytical assistant and validator.',
    system_prompt: 'You are an analytical AI helping the Physicist validate theories. Check logic, math, and consistency. Be supportive, curious, and concise.'
  }
};

const agentStatus = {
  AI_A: { loaded: false, lastResponse: null, reachable: null, lastCheck: null, lastError: null },
  AI_B: { loaded: false, lastResponse: null, reachable: null, lastCheck: null, lastError: null }
};

function getAgentProfile(agentKey) {
  const base = BASE_AGENTS[agentKey];
  if (!base) {
    throw new Error(`Unknown agent ${agentKey}`);
  }
  const config = getConfig() || {};
  const overrides = config.agents?.[agentKey] || {};
  return { ...base, ...overrides };
}

function describeAxiosError(err) {
  if (err.response) {
    return `${err.response.status} ${err.response.statusText || 'Response'}${err.response.data?.error?.message ? ` — ${err.response.data.error.message}` : ''}`;
  }
  if (err.code === 'ECONNREFUSED') {
    return 'Connection refused — ensure the provider service is running and reachable.';
  }
  if (err.code === 'ECONNABORTED') {
    return 'Request timed out — provider did not respond in time.';
  }
  return err.message || 'Unknown provider error';
}

async function sendMessage(agentKey, messages) {
  const agent = getAgentProfile(agentKey);
  const provider = providers[agent.provider];
  if (!provider) throw new Error(`Unknown provider ${agent.provider}`);

  const url = provider.base_url + provider.chat_endpoint;
  const payload = agent.provider === 'ollama'
    ? { model: agent.model, messages }
    : { model: agent.model, messages, stream: false };

  let response;
  try {
    response = await axios.post(url, payload, { timeout: 60000 });
  } catch (err) {
    agentStatus[agentKey] = {
      ...agentStatus[agentKey],
      reachable: false,
      lastCheck: new Date().toISOString(),
      lastError: describeAxiosError(err)
    };
    throw new Error(describeAxiosError(err));
  }
  const data = response.data;
  let text;
  if (data?.choices?.length) {
    text = data.choices[0].message?.content || data.choices[0].text;
  } else if (data?.message) {
    text = data.message?.content || data.message;
  } else if (data?.response) {
    text = data.response;
  }
  if (typeof text !== 'string') {
    text = JSON.stringify(data);
  }
  agentStatus[agentKey] = {
    loaded: true,
    lastResponse: new Date().toISOString(),
    reachable: true,
    lastCheck: new Date().toISOString(),
    lastError: null
  };
  return text.trim();
}

async function pingAgent(agentKey) {
  const agent = getAgentProfile(agentKey);
  const provider = providers[agent.provider];
  if (!provider) throw new Error(`Unknown provider ${agent.provider}`);

  const method = (provider.ping_method || 'get').toLowerCase();
  const url = provider.base_url + (provider.ping_endpoint || '/models');
  try {
    const response = await axios({ method, url, timeout: 5000 });
    agentStatus[agentKey] = {
      ...agentStatus[agentKey],
      reachable: true,
      lastCheck: new Date().toISOString(),
      lastError: null
    };
    return { ok: true, status: response.status };
  } catch (err) {
    agentStatus[agentKey] = {
      ...agentStatus[agentKey],
      reachable: false,
      lastCheck: new Date().toISOString(),
      lastError: describeAxiosError(err)
    };
    return { ok: false, message: describeAxiosError(err) };
  }
}

async function createEmbedding(agentKey, text) {
  const agent = getAgentProfile(agentKey);
  const provider = providers[agent.provider];
  if (!provider || !provider.embedding_endpoint) {
    return fallbackEmbeddingVector(text);
  }
  const url = provider.base_url + provider.embedding_endpoint;
  const payload = agent.provider === 'ollama'
    ? { model: agent.model, input: text }
    : { model: agent.model, input: text };
  try {
    const response = await axios.post(url, payload, { timeout: 60000 });
    const data = response.data;
    if (data?.data?.length) {
      return data.data[0].embedding;
    }
    if (data?.embedding) {
      return data.embedding;
    }
    console.warn('Embedding response malformed, falling back to lexical vector.');
  } catch (err) {
    console.warn(`Embedding call failed (${agent.provider}/${agent.model}): ${err.message}`);
  }
  return fallbackEmbeddingVector(text);
}

function getAgentStatus() {
  const agentAProfile = getAgentProfile('AI_A');
  const agentBProfile = getAgentProfile('AI_B');
  return {
    AI_A: { ...agentStatus.AI_A, name: BASE_AGENTS.AI_A.name, provider: agentAProfile.provider, model: agentAProfile.model },
    AI_B: { ...agentStatus.AI_B, name: BASE_AGENTS.AI_B.name, provider: agentBProfile.provider, model: agentBProfile.model }
  };
}

module.exports = {
  BASE_AGENTS,
  getAgentProfile,
  sendMessage,
  createEmbedding,
  getAgentStatus,
  pingAgent
};
