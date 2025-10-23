# TwinLine

TwinLine is a dual-agent conversation arena with an integrated FlowChunker subsystem for rapid, local-first experimentation with Flowfield concepts. It pairs two local LLMs (LM Studio and Ollama) in an alternating conversation loop while sharing a RAM-backed retrieval archive.

## Features

- Physicist ⇄ Validator alternating loop with configurable turn limit and delay
- FlowChunker RAM archive built from local files with token-aware chunking
- Live resource monitor for agents, RAG archive, and loop status
- Reasoning log capture saved to JSONL files per day
- Timestamped conversation transcripts for auditing and analysis
- Inline agent model switcher for quickly swapping LM Studio/Ollama model pairs

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

5. **Adjust agent models (optional)**

   - Use the "Physicist Model" and "Validator Model" cards at the top of the app to choose providers (`lmstudio` or `ollama`) and set custom model identifiers.
   - Click **Apply Models** to persist the selection to `config/config.json`; use **Reload Models** (bottom of the Loop panel) if you need to refresh embeddings after a change.

6. **Start the conversation loop**

   - Type an optional conversation starter in the text area at the bottom of the chat window (the value autosaves while you type).
   - Press **Start Loop** to kick off the alternating Physicist ⇄ Validator exchange; **Stop Loop** sits beside it for quick aborts.
   - Build archives and reload models from the actions anchored under the Loop status card in the sidebar.

> ℹ️  The development build opens Chromium Developer Tools automatically so you can inspect network calls—this is expected and can be closed if you don’t need it.

## FlowChunker CLI

The FlowChunker Python module can be executed independently to inspect chunk output:

```bash
python3 flowchunker/flowchunker.py --folder ./Flowfield
```

## Logs & Archives

- Conversation transcripts: `logs/conversations/session_<timestamp>.jsonl`
- Reasoning traces: `logs/reasoning/YYYY-MM-DD.jsonl`
- Optional archive mirrors: `archives/flowfield_<timestamp>.jsonl`

TwinLine automatically falls back to an internal lexical embedding when a provider’s `/embeddings` endpoint is unavailable (e.g., LM Studio without an embedding model loaded), so loop runs continue even if a remote request returns `404` or times out.

## License

MIT
