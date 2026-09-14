/**
 * Shared mock of the QVAC SDK surface used across @totemsdk/qvac tests.
 */

import type { QvacSdkLike } from '../qvac-sdk.js';

export function createMockQvacSdk(): QvacSdkLike {
  return {
    id: 'qvac',
    version: '0.19.0',

    async completion(params: Record<string, unknown>) {
      const prompt = String(params.prompt ?? '');
      return {
        text: `reply:${prompt}`,
        run: {
          stats: { tokensIn: 5, tokensOut: 7, durationMs: 12 },
        },
        model: params.model ?? 'mock-llm',
      };
    },

    async batchCompletion(params: Record<string, unknown>) {
      const prompts = Array.isArray(params.prompts) ? params.prompts : [params.prompt];
      return prompts.map((p, i) => ({
        text: `reply:${String(p)}`,
        run: { stats: { tokensIn: 1, tokensOut: 2, durationMs: 3 } },
        model: params.model ?? 'mock-llm',
        idx: i,
      }));
    },

    async embed(params: Record<string, unknown>) {
      const text = String(params.text ?? params.input ?? '');
      return {
        vector: new Array(8).fill(text.length),
        stats: { tokensIn: text.length, tokensOut: 0, durationMs: 4 },
      };
    },

    async ragSearch() {
      return { results: [{ id: 'doc-1', score: 0.9 }] };
    },

    async ragIngest() {
      return { ingested: 3 };
    },

    async transcribe(params: Record<string, unknown>) {
      return {
        transcript: `transcript:${String(params.language ?? 'en')}`,
        stats: { durationMs: 20 },
      };
    },

    async translate(params: Record<string, unknown>) {
      return {
        text: params.to ? `TR:${String(params.text ?? '')}` : String(params.text ?? ''),
        stats: { tokensIn: 2, tokensOut: 2, durationMs: 5 },
      };
    },

    async* transcribeStream() {
      yield { type: 'segment', text: 'hello' };
      yield { type: 'segment', text: 'world' };
    },

    async textToSpeech(params: Record<string, unknown>) {
      return { audio: new Uint8Array(4), mimeType: 'audio/wav', text: String(params.text ?? '') };
    },

    async* textToSpeechStream(params: Record<string, unknown>) {
      yield { audio: new Uint8Array(2), text: String(params.text ?? ''), chunk: 0 };
    },

    async diffusion() {
      return { image: 'data:image/png;base64,xxx', progress: { percent: 100 } };
    },

    async ocr() {
      return { text: 'OCR-001' };
    },

    async classify() {
      return { label: 'ok', confidence: 0.95 };
    },

    async audioGen() {
      return { audio: new Uint8Array(8), engine: 'ggml' };
    },

    async video() {
      return { video: 'data:video/mp4;base64,yyy', frames: 12 };
    },

    async vla() {
      return { action: 'grasp', confidence: 0.8 };
    },

    async worldCreateScene() {
      return { sceneId: 'scene-1' };
    },

    async worldStep() {
      return { result: 'moved' };
    },

    async loadModel(params: Record<string, unknown>) {
      return { id: params.model, loaded: true };
    },

    async unloadModel() {
      return { ok: true };
    },

    async getModelInfo() {
      return { id: 'mock-llm' };
    },

    async getLoadedModelInfo() {
      return { id: 'mock-llm', loaded: true };
    },

    async heartbeat() {
      return { status: 'ok' };
    },

    async getSystemResources() {
      return { cpu: 'arm64', gpu: 'none' };
    },

    async invokePlugin(params: Record<string, unknown>) {
      return { plugin: params.plugin, ok: true };
    },

    async cancel() {
      return { cancelled: true };
    },

    async close(): Promise<void> {
      return undefined;
    },
  };
}

export const MOCK_QVAC_VERSION = '0.19.0';