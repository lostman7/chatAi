const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/config.json');
let cachedConfig = null;

async function ensureSettingsLoaded() {
  if (!cachedConfig) {
    const raw = await fs.promises.readFile(configPath, 'utf-8');
    cachedConfig = JSON.parse(raw);
  }
  return cachedConfig;
}

function getConfig() {
  return cachedConfig;
}

async function updateConfig(newConfig) {
  cachedConfig = { ...cachedConfig, ...newConfig };
  await fs.promises.writeFile(configPath, JSON.stringify(cachedConfig, null, 2));
  return cachedConfig;
}

module.exports = {
  ensureSettingsLoaded,
  getConfig,
  updateConfig
};
