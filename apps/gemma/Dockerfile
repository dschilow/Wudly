FROM ollama/ollama:latest

ENV GEMMA_MODEL=gemma4:e4b
ENV OLLAMA_KEEP_ALIVE=30m
ENV OLLAMA_MODELS=/root/.ollama/models

COPY apps/gemma/start-ollama.sh /usr/local/bin/start-ollama.sh
RUN chmod +x /usr/local/bin/start-ollama.sh

EXPOSE 11434

ENTRYPOINT ["/usr/local/bin/start-ollama.sh"]
