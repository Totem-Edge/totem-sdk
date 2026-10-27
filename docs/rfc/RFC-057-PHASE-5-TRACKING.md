# RFC-057 Phase 5 — deployment hardening

Status: **partial** — encrypted dataset envelopes and quotas landed; key
rotation, selective replication, relay fallback, verified checkpoints,
process-kill recovery and ARM measurements remain.
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Landed

- `createAesGcmDatasetCipher` (`replication-holepunch`):
  - AES-256-GCM via WebCrypto;
  - versioned envelope (`version | 12-byte IV | ciphertext`);
  - malformed/unknown versions and wrong keys fail closed;
  - key length enforced (32 bytes).
- `ReplicationQuota`: fail-closed byte/record accounting with reset.
- Tests: envelope round-trip, wrong-key rejection, malformed envelope, quota
  exhaustion with no partial accounting.

## Open

1. Key rotation and dataset re-encryption handoff.
2. Selective replication/quotas persisted with the dataset; peer-level quotas.
3. Relay replication transport for browser/Android-Pear runtimes.
4. Verified checkpoint signatures and process-kill recovery test.
5. ARM64 resource measurements and Node/Bare/ARM recovery matrix.

Phase 5 gate is not met until (1)–(5) are covered.
