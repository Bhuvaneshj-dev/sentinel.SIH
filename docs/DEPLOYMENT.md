# Deployment

## Vercel frontend

Import **Bhuvaneshj-dev/sentinel.SIH** into Vercel. Use the repository root, not `frontend`, because the root `vercel.json` configures:

- Install: `npm --prefix frontend ci`
- Build: `npm --prefix frontend run build`
- Output: `frontend/dist`
- Framework: Other (configuration explicitly sets null)

No frontend secrets are required. The deployed console opens in clearly labelled scenario mode. All demo state is isolated in each tab's memory. A refresh clears it. This is a public workflow demonstration, not a publicly shared payment backend.

After Vercel returns a working production URL, verify it, replace the README deployment-status line with that URL, and set the repository About website where account permissions allow. Never invent a `vercel.app` URL.

## Optional live backend

Use the included Dockerfile or a Python 3.12 host with persistent disk. The simple Docker image includes the ONNX adapter code but no ML runtime/weights; extend the image with `ml/requirements.txt` and CPU PyTorch or onnxruntime when adding a real model. Keep model weights outside Git and mount them read-only. Use a persistent `/data` volume for SQLite.

Configure:

- Unique operator and approver secrets, at least 32 characters each.
- `SENTINEL_ALLOWED_ORIGINS` with the exact Vercel production origin (no trailing slash).
- `SENTINEL_DB` pointing to durable, private storage.
- Optional model path and required model dependencies.
- HTTPS/WSS at a reverse proxy; 32 KB maximum WebSocket frame size; one Uvicorn worker for the prototype stream cap.

Do not place role credentials in Vercel frontend environment variables or commit them. Enter them only in the console's gateway settings on a trusted device. For a real independent approval demonstration, use a second browser/device with the approver credential, rather than sharing both credentials with the operator.

The backend is a single-workspace prototype. Do not give public visitors shared backend credentials. Production requires tenant isolation, per-person identity, credential lifecycle management, rate limiting, monitoring and security review.

## Local full-stack demo

```bash
python scripts/init_env.py
docker compose up --build
```

Open http://localhost:8000, select Live gateway, leave Gateway URL blank, and enter the operator token from your local `.env`. A second browser session can connect with the approver token. Docker must be installed. Without a model, audio reports unavailable, while authorization remains functional.

## Deployment connection status

A Vercel project named `sentinel-sih` was created. Git import was rejected because Vercel does not yet have a GitHub Login Connection for this account. A later project read was denied for the selected team scope. No working production URL is claimed. Reconnect Vercel with access to the project scope, and connect GitHub within Vercel to enable automatic builds.

The existing Vercel login protection remains enabled. Public access requires explicit owner approval before disabling it.
