const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getConfig } = require('./settings');
const { createEmbedding } = require('./agentManager');

let archive = [];
let ramUsageBytes = 0;
let lastRetrieval = null;

function estimateSize(content) {
  return Buffer.byteLength(content, 'utf8');
}

async function runFlowChunker(folderPath) {
  const script = path.join(__dirname, '../flowchunker/flowchunker.py');
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [script, '--folder', folderPath]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FlowChunker failed: ${stderr}`));
      } else {
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

async function buildArchive(folderPath) {
  const config = getConfig();
  const targetFolder = folderPath || config.rag_folder;
  const exists = fs.existsSync(targetFolder);
  if (!exists) {
    return { ok: false, message: `Folder not found: ${targetFolder}` };
  }

  const chunkPayload = await runFlowChunker(targetFolder);
  const limitBytes = config.rag_ram_cap_mb * 1024 * 1024;

  archive = [];
  ramUsageBytes = 0;

  for (const chunk of chunkPayload) {
    if (!chunk.content || !chunk.content.trim()) continue;
    const embedding = await createEmbedding('AI_A', chunk.content.slice(0, 4000));
    const size = estimateSize(chunk.content);
    if (ramUsageBytes + size > limitBytes) {
      break;
    }
    archive.push({ ...chunk, embedding, size });
    ramUsageBytes += size;
  }

  if (config.autosave_archive) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(__dirname, `../archives/flowfield_${timestamp}.jsonl`);
    const lines = archive.map((item) => JSON.stringify({ id: item.id, source: item.source, content: item.content })).join('\n');
    fs.writeFileSync(archivePath, lines);
  }

  return {
    ok: true,
    chunks: archive.length,
    ramUsageMb: +(ramUsageBytes / (1024 * 1024)).toFixed(2)
  };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
    return 0;
  }
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  for (let i = length; i < a.length; i += 1) {
    const ai = a[i];
    if (typeof ai === 'number') {
      magA += ai * ai;
    }
  }
  for (let i = length; i < b.length; i += 1) {
    const bi = b[i];
    if (typeof bi === 'number') {
      magB += bi * bi;
    }
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function retrieveContext(query, topK) {
  if (!query || !archive.length) return [];
  const config = getConfig();
  const k = topK || config.rag_top_k;
  const embedding = await createEmbedding('AI_B', query.slice(0, 2000));
  const scored = [];
  for (const item of archive) {
    if (!item.embedding) {
      item.embedding = await createEmbedding('AI_A', item.content.slice(0, 4000));
    }
    scored.push({
      id: item.id,
      source: item.source,
      content: item.content,
      score: cosineSimilarity(item.embedding, embedding)
    });
  }
  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, k);
  lastRetrieval = {
    time: new Date().toISOString(),
    query,
    results: sorted.map((item) => ({ id: item.id, source: item.source, score: item.score }))
  };
  return sorted;
}

function getFlowStats() {
  return {
    ramUsageMb: +(ramUsageBytes / (1024 * 1024)).toFixed(2),
    capMb: getConfig().rag_ram_cap_mb,
    chunks: archive.length,
    lastRetrieval,
    archiveActive: archive.length > 0
  };
}

function reloadModels() {
  archive = archive.map((item) => ({ ...item, embedding: null }));
  return { ok: true, chunks: archive.length };
}

module.exports = {
  buildArchive,
  retrieveContext,
  getFlowStats,
  reloadModels
};
