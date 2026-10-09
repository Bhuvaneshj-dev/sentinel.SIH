# API

Interactive OpenAPI documentation: `/docs` on the backend. All protected HTTP requests use `Authorization: Bearer <role token>`.

| Endpoint | Role | Purpose |
|---|---|---|
| GET /api/health | Public | Readiness and model availability |
| GET /api/session | Either | Credential role |
| POST /api/calls | Operator | Start a call with a label |
| POST /api/calls/{id}/stop | Operator | End the call |
| WS /api/audio/{id} | Operator | First send JSON `{"token":"..."}`, then paced PCM blocks |
| GET /api/transfers | Either | List workspace sandbox transfers |
| POST /api/transfers | Operator | Body: call_id, beneficiary, integer amount_paise |
| POST /api/transfers/{id}/decision | Approver | Body: digest and approve boolean |
| POST /api/transfers/{id}/execute | Operator | Execute approved unexpired sandbox request once |
| GET /api/audit | Either | Last 500 events and full-chain consistency result |

Audio: 16 kHz mono float32 little-endian PCM in [-1,1], 100–500 ms per frame; browser uses 200 ms. A two-second window is required. The application does not stream raw audio back. No live score is emitted when the model is absent, inference fails, or insufficient evidence exists.

All routes operate on a single prototype workspace. Public multi-tenant access is not supported by the backend.
