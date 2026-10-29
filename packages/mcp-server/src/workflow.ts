/** Verified workflow assembly for generated applications. */

import type { SdkIndex } from './types.js'

export type WorkflowStepKind = 'code' | 'host-port' | 'unresolved'

export interface WorkflowStep {
  id: string
  capability: string
  package: string
  contract: string
  kind: WorkflowStepKind
  authority: 'none' | 'signature' | 'policy' | 'human' | 'provider'
  fixture?: string
  dependsOn?: string[]
  limitations?: string[]
}

export interface WorkflowPlan {
  steps: WorkflowStep[]
  hostPorts: string[]
  fixtures: string[]
  acceptance: string[]
  unresolved: string[]
}

export interface AdapterTemplate {
  capability: string
  contract: string
  imports: string[]
  body: string[]
  authority?: WorkflowStep['authority']
  fixture?: string
}

const ADAPTERS: Record<string, AdapterTemplate> = {
  '@totemsdk/core': {
    capability: 'hashing',
    contract: '@totemsdk/core#sha3_256',
    imports: ["const { sha3_256, toHex } = await import('@totemsdk/core');"],
    body: ["return toHex(sha3_256(new TextEncoder().encode('workflow-step')));"],
  },
  '@totemsdk/edge': {
    capability: 'edge device',
    contract: '@totemsdk/edge#createEdgeDevice',
    imports: ["const { createEdgeDevice } = await import('@totemsdk/edge');"],
    body: ["return createEdgeDevice({ kind: 'device' }).deviceId;"],
    fixture: 'edge-device fixture',
  },
  '@totemsdk/proofgraph': {
    capability: 'evidence graph',
    contract: '@totemsdk/proofgraph#createProofGraph',
    imports: ["const { createProofGraph } = await import('@totemsdk/proofgraph');"],
    body: ["return createProofGraph({ workflow: true }).graphId;"],
    authority: 'signature',
  },
  '@totemsdk/storage': {
    capability: 'artifact storage',
    contract: '@totemsdk/storage/artifacts#ArtifactStore.put',
    imports: [
      "const { ArtifactStore } = await import('@totemsdk/storage/artifacts');",
      "const { LocalFileBackend } = await import('@totemsdk/storage/artifacts/local-fs-backend');",
    ],
    body: [
      "const store = new ArtifactStore(new LocalFileBackend('./artifacts'));",
      "const receipt = await store.put('workflow', new TextEncoder().encode('artifact'));",
      "return receipt.ref.digest;",
    ],
  },
  '@totemsdk/replication': {
    capability: 'replica freshness',
    contract: '@totemsdk/replication#readReplicated',
    imports: ["const { readReplicated } = await import('@totemsdk/replication');"],
    body: [
      "const result = await readReplicated('workflow', {",
      "  readReplica: async () => ({ value: 'replica', complete: true, observedAt: Date.now() }),",
      '});',
      'return `${result.source}:${result.freshness}`;',
    ],
  },
  '@totemsdk/manifest': {
    capability: 'signed manifest',
    contract: '@totemsdk/manifest#createAnnouncement',
    imports: ["const { createAnnouncement } = await import('@totemsdk/manifest');"],
    body: [
      'const announcement = createAnnouncement({',
      "  kind: 'service',",
      "  subjectId: 'workflow',",
      "  subjectHash: '0x' + '11'.repeat(32),",
      "  publisher: 'MxWorkflowPublisher',",
      '  sequence: 1,',
      '  createdAt: Date.now(),',
      '  expiresAt: Date.now() + 86_400_000,',
      "  topics: ['totemsdk:workflow'],",
      "  nonce: 'workflow',",
      '});',
      'return announcement.announcementId;',
    ],
    authority: 'signature',
  },
  '@totemsdk/identity': {
    capability: 'identity binding',
    contract: '@totemsdk/identity#createIdentityDocument',
    imports: ["const { createIdentityDocument } = await import('@totemsdk/identity');"],
    body: [
      'const document = createIdentityDocument({',
      "  kind: 'service',",
      "  rootAddress: 'MxWorkflowRoot',",
      "  controllerAddress: 'MxWorkflowRoot',",
      '});',
      'return document.id;',
    ],
    authority: 'signature',
  },
  '@totemsdk/governance': {
    capability: 'governance decision',
    contract: '@totemsdk/governance#createGovernanceConfig',
    imports: ["const { createGovernanceConfig } = await import('@totemsdk/governance');"],
    body: [
      'const config = createGovernanceConfig({',
      "  daoId: 'workflow',",
      "  name: 'workflow',",
      "  voting: { algorithm: 'linear', quorumBps: 5000, passThresholdBps: 5000, votingPeriodMs: 86_400_000 },",
      '  membership: {},',
      "  authorityScope: 'workflow',",
      "  authorityResolver: 'workflow',",
      '});',
      'return config.daoId;',
    ],
    authority: 'policy',
  },
  '@totemsdk/omnia': {
    capability: 'payment channel',
    contract: '@totemsdk/omnia#buildEltooScript',
    imports: ["const { buildEltooScript } = await import('@totemsdk/omnia');"],
    body: [
      'return buildEltooScript([',
      "  { partyId: 'a', publicKeyDigest: '11'.repeat(32), addressIndex: 0 },",
      "  { partyId: 'b', publicKeyDigest: '22'.repeat(32), addressIndex: 0 },",
      ']);',
    ],
    authority: 'policy',
    fixture: 'channel participants fixture',
  },
}

const HOST_PORTS: Record<string, string> = {
  '@totemsdk/agent-policy': 'wallet policy/approval port',
  '@totemsdk/authority': 'authority verification port',
  '@totemsdk/proof': 'proof verification port',
  '@totemsdk/qvac': 'QVAC runtime/model host',
  '@totemsdk/edge-mqtt': 'MQTT broker',
  '@totemsdk/edge-modbus': 'Modbus endpoint',
  '@totemsdk/edge-opcua': 'OPC-UA endpoint',
  '@totemsdk/edge-bacnet': 'BACnet endpoint',
  '@totemsdk/edge-lorawan': 'LoRaWAN gateway',
  '@totemsdk/edge-ble': 'BLE host',
  '@totemsdk/edge-ros2': 'ROS 2 host',
  '@totemsdk/omnia-relay': 'Omnia relay URL',
  '@totemsdk/lookup-client': 'lookup node endpoint',
}

export function getWorkflowAdapter(packageName: string): AdapterTemplate | null {
  return ADAPTERS[packageName] ?? null
}

export function buildWorkflow(input: {
  directDependencies: string[]
  maturity: Record<string, string>
  requiredCapabilities: string[]
  index: SdkIndex
}): WorkflowPlan {
  const steps: WorkflowStep[] = []
  const hostPorts = new Set<string>()
  const fixtures = new Set<string>()
  const unresolved = new Set<string>()

  for (const [index, pkg] of input.directDependencies.entries()) {
    const adapter = ADAPTERS[pkg]
    if (adapter) {
      steps.push({
        id: `step-${index + 1}`,
        capability: adapter.capability,
        package: pkg,
        contract: adapter.contract,
        kind: 'code',
        authority: adapter.authority ?? 'none',
        ...(adapter.fixture ? { fixture: adapter.fixture } : {}),
        ...(index > 0 ? { dependsOn: [`step-${index}`] } : {}),
      })
      if (adapter.fixture) fixtures.add(adapter.fixture)
      continue
    }
    if (HOST_PORTS[pkg]) {
      hostPorts.add(`${pkg}: ${HOST_PORTS[pkg]}`)
      steps.push({
        id: `step-${index + 1}`,
        capability: HOST_PORTS[pkg],
        package: pkg,
        contract: 'host-supplied port',
        kind: 'host-port',
        authority: 'provider',
        ...(index > 0 ? { dependsOn: [`step-${index}`] } : {}),
      })
      continue
    }
    unresolved.add(pkg)
    steps.push({
      id: `step-${index + 1}`,
      capability: 'unresolved package workflow',
      package: pkg,
      contract: 'no verified adapter in the MCP catalogue',
      kind: 'unresolved',
      authority: 'none',
      limitations: ['No verified workflow adapter for this package.'],
    })
  }

  if (steps.length === 0) {
    steps.push({
      id: 'step-1',
      capability: 'composition',
      package: 'none',
      contract: 'no direct packages selected',
      kind: 'unresolved',
      authority: 'none',
      limitations: ['Select a composition before generating a workflow.'],
    })
  }

  const acceptance = [
    'Generated app installs and typechecks with the pinned dependency set.',
    'The workflow executes every code step and reports fixture/host-port steps explicitly.',
    'At least one negative or unauthorized input is rejected by the selected policy boundary.',
  ]
  if (input.requiredCapabilities.some((capability) => /evidence|proof/i.test(capability))) {
    acceptance.push('Tampered evidence is rejected, not treated as a valid attestation.')
  }

  return { steps, hostPorts: [...hostPorts], fixtures: [...fixtures], acceptance, unresolved: [...unresolved] }
}
