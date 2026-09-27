/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Sensor Proof Template — authenticates sensor readings from authorized devices.
 *
 * Use case: edge-modbus, edge-can, edge-ble, edge-lorawan, edge-ros2, edge-opcua, edge-bacnet, edge-matter
 *
 * Workflow:
 *   1. Device registers with a policy root (device identity → policy)
 *   2. Sensor reading is signed by the device's WOTS key
 *   3. Proof verifies: device is in policy root AND signature is valid AND reading is fresh
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyTree } from '../mast/types.js';
import { buildPolicyTree, type PolicyNodeInput } from '../mast/policy-tree.js';
import { buildProofChain, verifyProofChain, type ProofLink } from '../mast/proof-chain.js';
import { compileMastTree } from '../mast/mast-compiler.js';

export interface SensorProofConfig {
  /** Sensor/device identifier. */
  deviceId: string;
  /** The device's WOTS public key digest. */
  devicePkd: string;
  /** The policy root that authorizes this device. */
  policyRoot: string;
  /** Merkle proof that the device is in the policy root. */
  deviceProof: string;
  /**
   * The exact script leaf committed in `policyRoot` that authorizes this
   * device (the PROOF preimage). Defaults to the leaf produced by
   * `buildSensorFleetPolicy`: `ASSERT SIGNEDBY(0x<devicePkd>) RETURN TRUE`.
   */
  leafScript?: string;
  /** Maximum age of the reading in seconds. */
  maxAgeSeconds: number;
  /** The sensor reading value. */
  reading: string;
  /** The sensor reading timestamp (Unix ms). */
  timestamp: number;
  /** The device's WOTS signature over the reading. */
  signature: string;
}

/**
 * Build the KISSVM script for sensor proof verification.
 *
 * The script:
 *   1. Verifies the device is authorized (PROOF → MAST)
 *   2. Verifies the WOTS signature over the reading
 *   3. Verifies the reading is within the max age window
 *   4. Verifies the output preserves the reading as state
 */
export function buildSensorProofScript(config: SensorProofConfig): string {
  // RFC-016: PROOF takes the *leaf preimage* — the authorizing script, rendered
  // as a Minima SCRIPT literal `[ … ]` — not the device key bytes. A script MAST
  // (see buildSensorFleetPolicy) can only be proven by the script itself.
  const leafScript = config.leafScript ?? `ASSERT SIGNEDBY(0x${config.devicePkd}) RETURN TRUE`;
  return [
    `// Sensor proof: device ${config.deviceId}`,
    `LET devicePkd = 0x${config.devicePkd}`,
    `LET maxAge = ${config.maxAgeSeconds}`,
    ``,
    `// 1. Device is authorized by policy root`,
    `ASSERT PROOF([${leafScript}] 0 0x${config.policyRoot} 0 0x${config.deviceProof})`,
    // RFC-016 P2/P4: MAST takes the *policy root* (the proof is verified against
    // it), not the device public key.
    `MAST 0x${config.policyRoot}`,
    ``,
    `// 2. Reading is signed by the device`,
    // RFC-016 P4: freshness must use the committed observation, not a
    // spender-supplied current-state value.
    `LET reading = PREVSTATE(0)`,
    `LET sigTime = PREVSTATE(1)`,
    `ASSERT SIGDIG(2 reading)`,
    ``,
    `// 3. Reading is fresh`,
    `ASSERT @BLOCK SUB sigTime LTE maxAge`,
    ``,
    `// 4. Output preserves the reading`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');
}

/**
 * Build a policy tree for a fleet of sensor devices.
 *
 * @param devices - List of device public key digests.
 * @param fleetName - Human-readable fleet name.
 */
export function buildSensorFleetPolicy(devices: string[], fleetName: string): PolicyTree {
  const nodes: PolicyNodeInput[] = [
    {
      id: 'fleet-root',
      name: fleetName,
      script: 'RETURN TRUE',
    },
  ];

  for (let i = 0; i < devices.length; i++) {
    nodes.push({
      id: `device-${i}`,
      name: `Device ${i}`,
      script: `ASSERT SIGNEDBY(0x${devices[i]}) RETURN TRUE`,
      parentId: 'fleet-root',
    });
  }

  return buildPolicyTree(nodes);
}

/**
 * Build a proof chain for a sensor reading through a policy hierarchy.
 *
 * @param devicePkd - The device's public key digest.
 * @param fleetPolicy - The fleet policy tree.
 * @param reading - The sensor reading value.
 * @param timestamp - The reading timestamp.
 */
export function buildSensorProofChain(
  devicePkd: string,
  fleetPolicy: PolicyTree,
  reading: string,
  timestamp: number,
): ProofLink[] {
  const deviceNode = [...fleetPolicy.nodeMap.values()].find(
    n => n.script.includes(devicePkd),
  );
  if (!deviceNode) throw new Error(`Device ${devicePkd} not found in fleet policy`);

  // The fleet policy is flat: the root's policyRoot commits the root script and
  // every direct child (device) script as MMR leaves. Produce a real canonical
  // MMR proof of the device leaf against that root (previously this emitted the
  // script *hash* as the proof, which can never verify).
  const siblings = fleetPolicy.root.children;
  const childIndex = siblings.indexOf(deviceNode);
  if (childIndex < 0) {
    throw new Error(`Device ${devicePkd} is not a direct child of the fleet policy root`);
  }
  const scripts = [fleetPolicy.root.script, ...siblings.map(c => c.script)];
  const mast = compileMastTree(scripts);
  if (mast.rootHex !== fleetPolicy.root.policyRoot) {
    throw new Error('buildSensorProofChain: fleet policy root does not match the compiled MMR root');
  }

  const leafIndex = childIndex + 1;
  return [{
    scriptHash: deviceNode.scriptHash,
    policyRoot: mast.rootHex,
    proof: mast.scripts[leafIndex].proofHex,
    script: deviceNode.script,
    label: deviceNode.name,
    metadata: { reading, timestamp },
  }];
}
