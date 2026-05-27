# Dedupe GPU worker (reference)

Worker HTTP di riferimento per la pipeline Onizuka `DEDUPE_GPU_WEBHOOK_URL`.

## Avvio locale

```bash
export DEDUPE_GPU_WEBHOOK_SECRET=your-secret
export PORT=8080
python scripts/dedupe-gpu-worker/main.py
```

In Onizuka `.env`:

```
DEDUPE_GPU_WEBHOOK_URL=http://127.0.0.1:8080/
DEDUPE_GPU_WEBHOOK_SECRET=your-secret
```

## Docker

```bash
docker build -t onizuka-dedupe-gpu scripts/dedupe-gpu-worker
docker run -p 8080:8080 -e DEDUPE_GPU_WEBHOOK_SECRET=... onizuka-dedupe-gpu
```

## Produzione

Sostituire `train_stub()` in `main.py` con training PyTorch/CUDA sul dataset JSONL (URL in `datasetUrl` del payload).

Callback: `POST {callbackUrl}` con body `{ jobId, weights }` e header `X-Dedupe-Gpu-Secret`.
