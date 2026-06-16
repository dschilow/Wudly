#!/bin/sh
set -eu

export OLLAMA_HOST="0.0.0.0:${PORT:-11434}"
MODEL="${GEMMA_MODEL:-gemma4:e4b}"

ollama serve &
OLLAMA_PID="$!"

ready=0
for _ in $(seq 1 120); do
  if ollama list >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Ollama did not become ready in time" >&2
  exit 1
fi

echo "Ensuring Ollama model is available: ${MODEL}"
ollama pull "${MODEL}"

echo "Preloading Ollama model into memory: ${MODEL}"
set +e
if command -v timeout >/dev/null 2>&1; then
  timeout 600 ollama run "${MODEL}" "Antworte nur mit OK." >/dev/null 2>&1
else
  ollama run "${MODEL}" "Antworte nur mit OK." >/dev/null 2>&1
fi
PRELOAD_CODE="$?"
set -e
if [ "$PRELOAD_CODE" -ne 0 ]; then
  echo "Model preload did not complete in time; continuing anyway" >&2
else
  echo "Model preload complete"
fi

echo "Ollama is serving ${MODEL} on ${OLLAMA_HOST}"
wait "${OLLAMA_PID}"
