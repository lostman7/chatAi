const fs = require('fs');
const path = require('path');

class ReasoningLogger {
  constructor() {
    this.buffer = [];
    this.logDir = path.join(__dirname, '../logs/reasoning');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(entry) {
    const enriched = {
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.buffer.push(enriched);
    if (this.buffer.length > 10) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(this.logDir, `${day}.jsonl`);
    const lines = this.buffer.map((item) => JSON.stringify(item)).join('\n') + '\n';
    fs.appendFileSync(file, lines);
    this.buffer = [];
    return { flushed: true, file };
  }
}

module.exports = {
  ReasoningLogger
};
