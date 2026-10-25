[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / buildScriptProof

# Function: buildScriptProof()

> **buildScriptProof**(`script`): `Bytes`

Build the serialized Minima `ScriptProof` bytes for a single-leaf MMR.

Mirrors the node's `ScriptProof(const std::string& zScript)` constructor
(org/minima/objects/script_proof.cpp): the script is added as the sole leaf
of a fresh MMR with sum value ZERO, so the proof chain is empty and the
resulting address is the leaf commitment itself:

  address = sha3( MiniNumber.ZERO || MiniString(script) || MiniNumber.ZERO )
          = mmrLeafExact(script)

This is exactly how the node derives `Address(script)`, so a witness carrying
this proof satisfies `Witness::getScript(input.getAddress())` for every input
paying to that script. Without it the node rejects the TxPoW with
"Script Missing from TxPoW for address <addr>".

Wire format (`ScriptProof::writeDataStream`):
  MiniString(script) || MMRProof(blockTime = 0, chunks = [])

## Parameters

### script

`string`

The Minima (KISSVM) script whose address the proof attests.

## Returns

`Bytes`
