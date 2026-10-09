# Three-minute walkthrough

1. Open the console in Scenario demo mode. Point out that risk scores are simulated.
2. Start Voice impersonation. Watch the score rise past 0.80 over approximately eight seconds.
3. Request a sandbox transfer for INR 800,000 to the demo beneficiary. Explain that nothing can execute yet.
4. Open Approvals. Confirm the amount, beneficiary and fingerprint. Approve the exact details.
5. Execute the sandbox transfer. No money moves. Open Audit trail and export events.
6. End the session, select Detector misses the attack, and start again. Request a new transfer. Despite a low score, it is still held.
7. Reject this second request. Explain that audio risk is a signal, not authorization.

For real audio, follow `ml/README.md`, run the backend, connect Live gateway and use consented audio. Use a separate browser/device with only the approver credential to demonstrate actual role separation.

Do not describe the one-tab simulated approval flow as secure identity verification. No real or cloned personal recordings are redistributed in this release. Evaluation examples are manifests, not a packaged dataset.
