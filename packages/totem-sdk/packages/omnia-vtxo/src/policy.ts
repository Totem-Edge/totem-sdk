import { OmniaVtxo, VtxoId } from './types.js';

export interface VtxoTransferIntent {
  type: 'vtxo-transfer';
  poolId: string;
  inputId: VtxoId;
  recipient: string;
  amount: bigint;
  tokenId: string;
  nonce: string;
  changeNonce?: string;
}

export interface VtxoExitIntent {
  type: 'vtxo-exit';
  poolId: string;
  vtxoId: VtxoId;
  owner: string;
  amount: bigint;
  tokenId: string;
  draftType: 'mock-exit';
}

export function buildVtxoTransferIntent(
  vtxo: OmniaVtxo,
  recipient: string,
  amount: bigint,
  nonce: string,
  changeNonce?: string,
): VtxoTransferIntent {
  return {
    type: 'vtxo-transfer',
    poolId: vtxo.poolId,
    inputId: vtxo.vtxoId,
    recipient,
    amount,
    tokenId: vtxo.tokenId,
    nonce,
    changeNonce,
  };
}

export function buildVtxoExitIntent(vtxo: OmniaVtxo): VtxoExitIntent {
  return {
    type: 'vtxo-exit',
    poolId: vtxo.poolId,
    vtxoId: vtxo.vtxoId,
    owner: vtxo.owner,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    draftType: 'mock-exit',
  };
}
