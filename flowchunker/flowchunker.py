#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path

SUPPORTED_EXTENSIONS = {'.txt', '.md', '.json'}

def flow_chunk(text, max_tokens=1000, overlap=200):
    chunks, buf, tok = [], [], 0
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("### [") or stripped == "---":
            if buf:
                chunks.append("\n".join(buf))
                buf, tok = [], 0
        buf.append(line)
        tok += len(line.split())
        if tok >= max_tokens:
            chunks.append("\n".join(buf))
            buf, tok = buf[-overlap:], 0
    if buf:
        chunks.append("\n".join(buf))
    return chunks

def build_archive(folder):
    folder_path = Path(folder)
    if not folder_path.exists():
        raise FileNotFoundError(f"Folder not found: {folder}")
    entries = []
    for file_path in folder_path.rglob('*'):
        if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            text = file_path.read_text(encoding='utf-8')
        except Exception:
            continue
        chunks = flow_chunk(text)
        for idx, chunk in enumerate(chunks):
            entries.append({
                'id': f"{file_path.name}-{idx}",
                'source': str(file_path.relative_to(folder_path)),
                'content': chunk
            })
    return entries

def main():
    parser = argparse.ArgumentParser(description='FlowChunker archive builder')
    parser.add_argument('--folder', required=True, help='Folder to scan for RAG content')
    args = parser.parse_args()
    try:
        archive = build_archive(args.folder)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    print(json.dumps(archive))

if __name__ == '__main__':
    main()
