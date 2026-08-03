import {
  bytesToHex,
  type MinimaTransaction,
  type RawStateVariable,
  type StateVariable,
} from '@totemsdk/core';

function stateVarJson(sv: StateVariable | RawStateVariable): { port: number; svtype: string; data: string } {
  if ('rawData' in sv) {
    return { port: sv.port, svtype: sv.type.toString(), data: bytesToHex(sv.rawData) };
  }
  switch (sv.type) {
    case 'bool':
      return { port: sv.port, svtype: 'bool', data: sv.value ? 'true' : 'false' };
    case 'number':
      return { port: sv.port, svtype: 'number', data: sv.value.toString() };
    case 'string':
      return { port: sv.port, svtype: 'string', data: String(sv.value) };
    case 'hex':
    default:
      return { port: sv.port, svtype: 'hex', data: bytesToHex(sv.value as Uint8Array) };
  }
}

/**
 * Convert a MinimaTransaction (JS object form with Uint8Array fields) into the
 * JSON schema consumed by the @totemsdk/core WASM serializers.
 */
export function minimaTransactionToJson(tx: MinimaTransaction): Record<string, unknown> {
  const coinJson = (
    coin: MinimaTransaction['inputs'][number],
    includeCoinId: boolean
  ): Record<string, unknown> => {
    const json: Record<string, unknown> = {
      amount: coin.amount,
      address: bytesToHex(coin.address),
      tokenid: bytesToHex(coin.tokenId),
      state: coin.state.length ? coin.state.map(stateVarJson) : [],
      storestate: coin.storeState,
      mmrentry: coin.mmrEntryNumber.toString(),
      spent: coin.spent,
      created: coin.created.toString(),
      token: null,
    };
    if (includeCoinId) json.coinid = bytesToHex(coin.coinId);
    return json;
  };

  return {
    linkhash: '0x00',
    inputs: tx.inputs.map((c) => coinJson(c, true)),
    outputs: tx.outputs.map((c) => coinJson(c, false)),
    state: tx.state.length ? tx.state.map(stateVarJson) : [],
  };
}
