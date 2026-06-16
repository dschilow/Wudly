#!/bin/sh
set -eu

# Railway's private network (*.railway.internal) is IPv6-only. Ollama MUST listen
# on IPv6 ([::]) — binding to 0.0.0.0 (IPv4-only) makes wudly-api's requests to
# wudly-gemma.railway.internal hang until they time out. On Linux [::] is dual-stack,
# so Railway's healthcheck and this script's local CLI (over loopback) still work.
PORT_VALUE="${PORT:-11434}"
SERVE_HOST="[::]:${PORT_VALUE}"
MODEL="${GEMMA_MODEL:-gemma4:e4b}"

# Serve on all interfaces (IPv6 + IPv4 via dual-stack)...
OLLAMA_HOST="${SERVE_HOST}" ollama serve &
OLLAMA_PID="$!"

# ...but let the CLI calls below (list/pull/run) reach the server over IPv4 loopback.
export OLLAMA_HOST="127.0.0.1:${PORT_VALUE}"

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

echo "Ollama is serving ${MODEL} on ${SERVE_HOST} (local CLI via ${OLLAMA_HOST})"
wait "${OLLAMA_PID}"
