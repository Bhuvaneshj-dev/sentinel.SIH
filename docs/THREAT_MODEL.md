# Threat model and limits

Protected asset: integrity of sandbox transaction authorization. Attacker: a caller with synthetic or genuine audio, plus an unauthorized API client. Trusted boundary: the backend, its private role credentials, and database host.

| Threat | Implemented control | Remaining limit |
|---|---|---|
| Convincing cloned voice | Optional audio score plus independent approval | Model can miss attacks; trusted approver can be deceived |
| Operator self-approval | Distinct backend role credentials | Shared static credentials are not per-person identity |
| Changed payment details | Digest-bound immutable transaction fields | A compromised backend is out of scope |
| Replayed/expired approval | Expiry and atomic one-time execution | Production bank execution needs idempotency across systems |
| Duplicate execution | SQLite immediate write transaction | Prototype is single-node |
| Unauthorized audio stream | First-message auth and Origin check | Full abuse/rate limiting remains future work |
| Audio storage exposure | No application recording endpoint or audio logs | Browser/OS memory, infrastructure and crash dumps need separate controls |
| Audit modification | Hash-chain verification | Full database attackers can rewrite the entire chain |

This is not a banking product, compliance certification, speaker identity system, or guarantee against fraud. SIP, PSTN, Finacle, BaNCS, MFA provider integrations and multi-tenant access are not implemented. Sandbox transfers do not move money.
