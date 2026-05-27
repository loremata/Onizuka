#!/usr/bin/env python3
"""
Reference GPU/CPU worker for Onizuka dedupe training.
POST body from Onizuka: { jobId, datasetUrl, callbackUrl }
Responds to training webhook and POSTs weights to callbackUrl with X-Dedupe-Gpu-Secret.

Env:
  DEDUPE_GPU_WEBHOOK_SECRET — must match Onizuka
  PORT — default 8080
"""
from __future__ import annotations

import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer


SECRET = os.environ.get("DEDUPE_GPU_WEBHOOK_SECRET", "").strip()
PORT = int(os.environ.get("PORT", "8080"))


def train_stub(pairs_count: int = 100) -> dict:
    """Replace with PyTorch training on dataset from datasetUrl."""
    return {
        "version": 2,
        "weights": {"vatExact": 1.0, "nameToken": 0.85, "emailDomain": 0.7},
        "notes": f"stub-gpu-worker pairs~{pairs_count}",
    }


def post_callback(callback_url: str, job_id: str, weights: dict) -> None:
    body = json.dumps({"jobId": job_id, "weights": weights}).encode("utf-8")
    req = urllib.request.Request(
        callback_url,
        data=body,
        headers={
            "Content-Type": "application/json",
            **({"X-Dedupe-Gpu-Secret": SECRET} if SECRET else {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        if res.status >= 400:
            raise RuntimeError(f"callback failed {res.status}")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        if SECRET:
            hdr = self.headers.get("X-Dedupe-Gpu-Secret", "")
            if hdr != SECRET:
                self.send_response(401)
                self.end_headers()
                return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        job_id = payload.get("jobId")
        callback_url = payload.get("callbackUrl")
        if not job_id or not callback_url:
            self.send_response(400)
            self.end_headers()
            return

        try:
            weights = train_stub()
            post_callback(callback_url, job_id, weights)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "jobId": job_id}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, fmt, *args):  # noqa: A003
        return


if __name__ == "__main__":
    print(f"Dedupe GPU worker listening on :{PORT}")
    HTTPServer(("", PORT), Handler).serve_forever()
