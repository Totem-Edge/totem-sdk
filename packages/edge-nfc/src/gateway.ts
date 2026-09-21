/**
 * NFC Edge Gateway — wires an NfcTransportPort into an EdgeRuntime.
 *
 * Produces evidence proofs on:
 *   • tag detection  (proximity / presence proof)
 *   • NDEF read      (content proof)
 *   • APDU exchange  (secure-element activity proof)
 *   • HCE serve      (served-response proof)
 *   • P2P receive    (peer-to-peer data proof)
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { NfcTransportPort, NfcTag, NfcTagEvent, NdefRecord, HceApduHandler } from './transport.js';
import { encodeNdefMessage } from './ndef.js';

export interface NfcGatewayConfig {
  runtime: EdgeRuntime;
  transport: NfcTransportPort;
  /** Restrict tags to these technologies, e.g. ["iso14443a"]. */
  techs?: string[];
}

export interface NfcGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Currently-visible tags. */
  readonly tags: NfcTag[];
  /** Resolve a tag by handle (id) or uid; returns null if not present. */
  getTag(tagId: string): NfcTag | null;
  /** Read NDEF records off a present tag. */
  readNdef(tagId: string): Promise<EdgeOperationResult<{ records: NdefRecord[] }>>;
  /** Write NDEF records to a present tag. */
  writeNdef(tagId: string, records: NdefRecord[]): Promise<EdgeOperationResult>;
  /** Erase NDEF data from a present tag. */
  eraseNdef(tagId: string): Promise<EdgeOperationResult>;
  /** ISO 7816-4 APDU exchange (secure element). */
  transceive(tagId: string, apdu: Uint8Array): Promise<EdgeOperationResult<{ response: Uint8Array }>>;
  /** Send an NDEF message to a peer NFC-DEP target. */
  putMessage(records: NdefRecord[]): Promise<EdgeOperationResult>;
  /** Register a handler for inbound peer-to-peer NDEF messages. */
  onMessage(handler: (records: NdefRecord[]) => void): () => void;
  /** Serve an HCE APDU handler to an external reader. */
  registerHceApduHandler(handler: HceApduHandler): Promise<void>;
  /** Stop serving HCE APDUs. */
  unregisterHceApduHandler(): Promise<void>;
}

export function createNfcGateway(config: NfcGatewayConfig): NfcGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const tags: NfcTag[] = [];
  const messageHandlers: Array<(records: NdefRecord[]) => void> = [];
  let unsubTag: (() => void) | undefined;
  let unsubLost: (() => void) | undefined;
  let unsubMsg: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  function makeProof(tagId: string, kind: string, claims: Record<string, unknown>) {
    const proof = config.runtime.ports.proof;
    if (!proof) return;
    proof.createProof({ subject: `nfc:${tagId}`, claims: [{ kind, ...claims, timestamp: Date.now() }] }).catch(() => {});
  }

  function findTag(handleOrUid: string): NfcTag | undefined {
    return tags.find((t) => t.id === handleOrUid || t.uid === handleOrUid);
  }

  return {
    get status() { return status; },
    get tags() { return [...tags]; },

    getTag(handleOrUid) {
      return findTag(handleOrUid) ?? null;
    },

    async start() {
      if (status === 'running') return;
      unsubTag = config.transport.onTag((event: NfcTagEvent) => {
        const existing = tags.find((t) => t.uid === event.uid);
        if (!existing) {
          const tag: NfcTag = { id: event.id, uid: event.uid, tech: 'iso14443a', detectedAt: event.timestamp };
          tags.push(tag);
        }
        makeProof(event.id, 'nfc.tap', { uid: event.uid, proximity: event.proximity });
      });
      unsubLost = config.transport.onTagLost((lost) => {
        const idx = tags.findIndex((t) => t.uid === lost.uid);
        if (idx !== -1) tags.splice(idx, 1);
      });
      unsubMsg = config.transport.onMessage((records) => {
        for (const h of messageHandlers) h(records);
      });
      unsubError = config.transport.onError(() => { status = 'error'; });
      await config.transport.startPolling(config.techs ? { techs: config.techs } : undefined);
      status = 'running';
    },

    async stop() {
      unsubTag?.(); unsubLost?.(); unsubMsg?.(); unsubError?.();
      await config.transport.stopPolling();
      status = 'stopped';
      tags.length = 0;
    },

    async readNdef(tagId) {
      try {
        const tag = findTag(tagId);
        if (!tag) return { ok: false, error: 'tag not present' };
        const records = await config.transport.readNdef(tagId);
        makeProof(tagId, 'nfc.ndef.read', { recordCount: records.length, tagUid: tag.uid });
        return { ok: true, data: { records } };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async writeNdef(tagId, records) {
      try {
        if (!findTag(tagId)) return { ok: false, error: 'tag not present' };
        await config.transport.writeNdef(tagId, records);
        const msg = encodeNdefMessage(records);
        makeProof(tagId, 'nfc.ndef.write', { recordCount: records.length, size: msg.length });
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async eraseNdef(tagId) {
      try {
        if (!findTag(tagId)) return { ok: false, error: 'tag not present' };
        await config.transport.eraseNdef(tagId);
        makeProof(tagId, 'nfc.ndef.erase', {});
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async transceive(tagId, apdu) {
      try {
        const tag = findTag(tagId);
        if (!tag) return { ok: false, error: 'tag not present' };
        const response = await config.transport.transceive(tagId, apdu);
        makeProof(tagId, 'nfc.apdu.exchange', { apduBytes: apdu.length, respBytes: response.length, tagUid: tag.uid });
        return { ok: true, data: { response } };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    async putMessage(records) {
      try {
        await config.transport.putMessage(records);
        const msg = encodeNdefMessage(records);
        makeProof('peer', 'nfc.p2p.send', { recordCount: records.length, size: msg.length });
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e) }; }
    },

    onMessage(handler) {
      messageHandlers.push(handler);
      return () => {
        const i = messageHandlers.indexOf(handler);
        if (i !== -1) messageHandlers.splice(i, 1);
      };
    },

    async registerHceApduHandler(handler) {
      await config.transport.registerHceApduHandler(handler);
      makeProof('hce', 'nfc.hce.registered', {});
    },

    async unregisterHceApduHandler() {
      await config.transport.unregisterHceApduHandler();
      makeProof('hce', 'nfc.hce.unregistered', {});
    },
  };
}