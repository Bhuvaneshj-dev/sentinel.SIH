# Security

This repository is a research prototype with sandbox-only transactions. Do not use it to authorize real funds or publish shared gateway credentials.

Never commit `.env`, model-training credentials, private audio or live databases. Default role credentials are empty, and the API rejects operations until distinct secrets are configured.

Report vulnerabilities privately to the repository owner through GitHub private vulnerability reporting if enabled. Do not put working credentials or private recordings in public issues. See [the threat model](docs/THREAT_MODEL.md) for scope and limitations.
