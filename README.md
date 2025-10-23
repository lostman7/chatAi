# TwinLine

TwinLine is a dual-agent conversation arena with an integrated FlowChunker subsystem for rapid, local-first experimentation with Flowfield concepts. It pairs two local LLMs (LM Studio and Ollama) in an alternating conversation loop while sharing a RAM-backed retrieval archive.

## Features

- Physicist ⇄ Validator alternating loop with configurable turn limit and delay
- FlowChunker RAM archive built from local files with token-aware chunking
- Live resource monitor for agents, RAG archive, and loop status
- Reasoning log capture saved to JSONL files per day
- Timestamped conversation transcripts for auditing and analysis

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Prepare local models**

   - Ensure LM Studio exposes an OpenAI-compatible REST API at `http://localhost:1234/v1`
   - Ensure Ollama is running at `http://localhost:11434/api`

3. **Seed Flowfield knowledge**

   - Place `.txt`, `.md`, or `.json` files in the `Flowfield/` directory (or update `config/config.json` with a custom path)

4. **Launch TwinLine**

   ```bash
   npm run dev
   ```

   In production, use `npm run build` to produce distributable binaries via `electron-builder`.

## FlowChunker CLI

The FlowChunker Python module can be executed independently to inspect chunk output:

```bash
python3 flowchunker/flowchunker.py --folder ./Flowfield
```

## Logs & Archives

- Conversation transcripts: `logs/conversations/session_<timestamp>.jsonl`
- Reasoning traces: `logs/reasoning/YYYY-MM-DD.jsonl`
- Optional archive mirrors: `archives/flowfield_<timestamp>.jsonl`

## License

MIT
