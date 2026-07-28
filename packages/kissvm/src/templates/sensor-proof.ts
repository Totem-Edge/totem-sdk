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

export interface SensorProofConfig {
  /** Sensor/device identifier. */
  deviceId: string;
  /** The device's WOTS public key digest. */
  devicePkd: string;
  /** The policy root that authorizes this device. */
  policyRoot: string;
  /** Merkle proof that the device is in the policy root. */
  deviceProof: string;
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
  return [
    `// Sensor proof: device ${config.deviceId}`,
    `LET devicePkd = 0x${config.devicePkd}`,
    `LET maxAge = ${config.maxAgeSeconds}`,
    ``,
    `// 1. Device is authorized by policy root`,
    `ASSERT PROOF(0x${config.devicePkd} 0 0x${config.policyRoot} 0 0x${config.deviceProof})`,
    `MAST 0x${config.devicePkd}`,
    ``,
    `// 2. Reading is signed by the device`,
    `LET reading = STATE(0)`,
    `LET sigTime = STATE(1)`,
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

  const path = [fleetPolicy.root];
  let current = deviceNode;
  while (current.parentId) {
    path.push(current);
    current = fleetPolicy.nodeMap.get(current.parentId)!;
  }

  return path.map((node, i) => ({
    scriptHash: node.scriptHash,
    policyRoot: node.policyRoot,
    proof: i === 0 ? '' : node.scriptHash, // Simplified: real impl uses Merkle proof
    script: node.script,
    label: node.name,
    metadata: { reading, timestamp },
  }));
}
