/**
 * RFC-024 §5.3 — governed OCPP operations.
 *
 * Each definition prepares a deterministic, commitment-bound OCPP command and
 * derives its physical effects from that prepared command (never from hints).
 * `startSession`/`stopSession` are asynchronous: acceptance is not completion,
 * and completion is established by charger meter/transaction readback.
 *
 * Configuration writes (`setLimit`, `clearProfile`, `reserveConnector`) use
 * `confirmation: 'completed'` because the CSMS acknowledgement *is* the terminal
 * state for a profile/ reservation change; only a session has a later physical
 * outcome to observe.
 */

import {
  defaultUnitRegistry,
  hashCanonical,
  resourceIdKey,
  type IndustrialActionDefinition,
  type UnitRegistry,
} from '@totemsdk/act-core';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type { StepEffects } from '@totemsdk/agent-policy';

import type { OcppCapabilitySet } from './capabilities.js';
import { deriveChargingEffects } from './effects.js';
import { reconcileChargingSession } from './meter.js';
import {
  chargingResourceId,
  ocppErrorTaxonomy,
  OCPP_PROTOCOL,
  type ChargingConnector,
} from './profile.js';
import {
  assertAccepted,
  OcppTransportError,
  type OcppResponse,
  type OcppTransportPort,
} from './transport.js';

export interface OcppAdapterOptions {
  transport: OcppTransportPort;
  site: string;
  connectors: readonly ChargingConnector[];
  capabilities?: OcppCapabilitySet;
  units?: UnitRegistry;
}

interface ChargingCommand {
  action: string;
  connectorId: number;
  [key: string]: unknown;
}

function decimal(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(9)));
}

function quantityValue(
  value: unknown,
  unit: string,
  units: UnitRegistry,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object' && 'value' in value && 'unit' in value) {
    return units.convert(value as { value: number; unit: string }, unit).value;
  }
  return undefined;
}

function numberParameter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new OcppTransportError('Invalid', `expected a number, got '${String(value)}'`);
}

function stringParameter(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new OcppTransportError('Invalid', `expected a non-empty string, got '${String(value)}'`);
}

function commandOf(op: { command?: unknown }): ChargingCommand {
  return op.command as ChargingCommand;
}

function findConnector(options: OcppAdapterOptions, connectorId: number): ChargingConnector {
  const connector = options.connectors.find((candidate) => candidate.connectorId === connectorId);
  if (!connector) {
    throw new OcppTransportError('Invalid', `connector ${connectorId} is not registered`);
  }
  return connector;
}

function responseData(response: OcppResponse): Record<string, unknown> {
  return { status: response.status ?? 'Accepted', ...(response.payload ?? {}) };
}

function acceptedResult(response: OcppResponse): EdgeOperationResult {
  assertAccepted(response, 'OCPP operation');
  return { ok: true, data: responseData(response) };
}

function transactionIdOf(record: { result?: unknown }): number | undefined {
  const data = record.result as { transactionId?: unknown } | undefined;
  return typeof data?.transactionId === 'number' ? data.transactionId : undefined;
}

export function createOcppDefinitions(
  options: OcppAdapterOptions,
): IndustrialActionDefinition[] {
  const units = options.units ?? defaultUnitRegistry();
  const taxonomy = ocppErrorTaxonomy();
  const transport = options.transport;

  function profileDigest(command: ChargingCommand): string | undefined {
    if (command.maxPowerWatts === undefined) return undefined;
    return hashCanonical('TOTEM_ACT_OCPP_CHARGING_PROFILE_V1', {
      connectorId: command.connectorId,
      maxPowerWatts: command.maxPowerWatts,
      maxEnergyWattHours: command.maxEnergyWattHours ?? null,
      maxSessionSeconds: command.maxSessionSeconds ?? null,
    });
  }

  function resourceFor(connectorId: number): string {
    return resourceIdKey(chargingResourceId(options.site, connectorId));
  }

  const definitions: IndustrialActionDefinition[] = [
    {
      kind: 'charging:startSession',
      description: 'Start a bounded charging session on a connector through the governed runtime.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true, description: 'Target connector id.' },
          { name: 'idTag', type: 'string', required: true, description: 'Contract/authorization tag.' },
          {
            name: 'maxPowerWatts', type: 'quantity', required: true,
            dimension: 'power', unit: 'W', description: 'Instantaneous power ceiling.',
          },
          {
            name: 'maxEnergyWattHours', type: 'quantity', required: false,
            dimension: 'energy', unit: 'Wh', description: 'Session energy ceiling.',
          },
          {
            name: 'maxSessionSeconds', type: 'quantity', required: false,
            dimension: 'time', unit: 's', description: 'Session duration ceiling.',
          },
        ],
        context: [],
      },
      policy: { failureMode: 'fail-safe', timeoutMs: 30_000 },
      safeState: async (op) => {
        const command = commandOf(op);
        if (!transport.stopConnector) {
          return { ok: false, error: 'transport cannot stop an active connector session' };
        }
        return acceptedResult(await transport.stopConnector(command.connectorId));
      },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const maxPowerWatts = quantityValue(params.maxPowerWatts, 'W', units);
        if (maxPowerWatts === undefined) {
          throw new OcppTransportError('Invalid', 'maxPowerWatts is required');
        }
        const command: ChargingCommand = {
          action: 'RemoteStartTransaction',
          connectorId,
          idTag: stringParameter(params.idTag),
          maxPowerWatts: decimal(maxPowerWatts),
        };
        const maxEnergy = quantityValue(params.maxEnergyWattHours, 'Wh', units);
        if (maxEnergy !== undefined) command.maxEnergyWattHours = decimal(maxEnergy);
        const maxSeconds = quantityValue(params.maxSessionSeconds, 's', units);
        if (maxSeconds !== undefined) command.maxSessionSeconds = decimal(maxSeconds);
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(op) {
        const command = commandOf(op);
        return deriveChargingEffects({
          resource: resourceFor(command.connectorId),
          maxPowerWatts: String(command.maxPowerWatts),
          ...(command.maxEnergyWattHours !== undefined
            ? { maxEnergyWattHours: String(command.maxEnergyWattHours) }
            : {}),
          ...(command.maxSessionSeconds !== undefined
            ? { maxSessionSeconds: String(command.maxSessionSeconds) }
            : {}),
          profileId: `connector:${command.connectorId}`,
          profileDigest: profileDigest(command) ?? 'none',
        });
      },
      async actuate(op) {
        const command = commandOf(op);
        const response = await transport.remoteStartTransaction({
          connectorId: command.connectorId,
          idTag: String(command.idTag),
          ...(command.maxPowerWatts !== undefined ? { maxPowerWatts: String(command.maxPowerWatts) } : {}),
          ...(command.maxEnergyWattHours !== undefined
            ? { maxEnergyWattHours: String(command.maxEnergyWattHours) }
            : {}),
          ...(command.maxSessionSeconds !== undefined
            ? { maxSessionSeconds: String(command.maxSessionSeconds) }
            : {}),
        });
        return acceptedResult(response);
      },
      async: {
        confirmation: 'accepted',
        async reconcile(op, record) {
          const command = commandOf(op);
          const transactionId = transactionIdOf(record);
          if (transactionId === undefined) {
            return { status: 'unknown', error: 'no transaction id available for reconciliation' };
          }
          const reading = await reconcileChargingSession(transport, {
            operationId: record.operationId,
            connectorId: command.connectorId,
            transactionId,
          });
          if (reading.status === 'confirmed') {
            return {
              status: 'confirmed',
              handle: { transactionId },
              progress: { fraction: 1, detail: 'transaction ended', at: Date.now() },
              result: reading.evidence,
            };
          }
          if (reading.status === 'running') {
            return {
              status: 'running',
              handle: { transactionId },
              progress: { detail: reading.detail ?? 'charging', at: Date.now() },
            };
          }
          return { status: 'unknown', error: reading.detail };
        },
        async cancel(op, record) {
          const command = commandOf(op);
          const transactionId = transactionIdOf(record);
          if (transactionId !== undefined) {
            await stopSession(command.connectorId, transactionId);
            return;
          }
          if (!transport.stopConnector) {
            throw new OcppTransportError('Invalid', 'cannot cancel without a transaction id');
          }
          await transport.stopConnector(command.connectorId);
        },
      },
    },
    {
      kind: 'charging:stopSession',
      description: 'Stop a charging session; completion is confirmed by meter readback.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true },
          { name: 'transactionId', type: 'number', required: true },
        ],
        context: [],
      },
      policy: { failureMode: 'fail-safe', timeoutMs: 30_000 },
      safeState: async (op) => {
        const command = commandOf(op);
        return stopSession(command.connectorId, numberParameter(command.transactionId));
      },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const command: ChargingCommand = {
          action: 'RemoteStopTransaction',
          connectorId,
          transactionId: numberParameter(params.transactionId),
        };
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(op) {
        const command = commandOf(op);
        return { spends: [], physical: { duration: [{ resource: resourceFor(command.connectorId), seconds: '0' }] } };
      },
      async actuate(op) {
        const command = commandOf(op);
        const response = await transport.remoteStopTransaction({
          connectorId: command.connectorId,
          transactionId: numberParameter(command.transactionId),
        });
        return acceptedResult(response);
      },
      async: {
        confirmation: 'accepted',
        async reconcile(op, record) {
          const command = commandOf(op);
          const transactionId = numberParameter(command.transactionId);
          const reading = await reconcileChargingSession(transport, {
            operationId: record.operationId,
            connectorId: command.connectorId,
            transactionId,
          });
          if (reading.status === 'confirmed') {
            return {
              status: 'confirmed',
              handle: { transactionId },
              progress: { fraction: 1, detail: 'transaction ended', at: Date.now() },
              result: reading.evidence,
            };
          }
          return {
            status: reading.status === 'running' ? 'running' : 'unknown',
            handle: { transactionId },
            ...(reading.detail !== undefined ? { error: reading.detail } : {}),
          };
        },
        async cancel(op) {
          const command = commandOf(op);
          await stopSession(command.connectorId, numberParameter(command.transactionId));
        },
      },
    },
    {
      kind: 'charging:setLimit',
      description: 'Apply a bounded charging profile to a connector.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true },
          { name: 'profileId', type: 'number', required: true },
          {
            name: 'maxPowerWatts', type: 'quantity', required: true,
            dimension: 'power', unit: 'W',
          },
          {
            name: 'maxEnergyWattHours', type: 'quantity', required: false,
            dimension: 'energy', unit: 'Wh',
          },
          {
            name: 'maxSessionSeconds', type: 'quantity', required: false,
            dimension: 'time', unit: 's',
          },
        ],
        context: [],
      },
      policy: { failureMode: 'fail-safe', timeoutMs: 30_000 },
      safeState: async (op) => {
        const command = commandOf(op);
        return clearProfile(command.connectorId, Number(command.profileId));
      },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const maxPowerWatts = quantityValue(params.maxPowerWatts, 'W', units);
        if (maxPowerWatts === undefined) {
          throw new OcppTransportError('Invalid', 'maxPowerWatts is required');
        }
        const command: ChargingCommand = {
          action: 'SetChargingProfile',
          connectorId,
          profileId: numberParameter(params.profileId),
          maxPowerWatts: decimal(maxPowerWatts),
        };
        const maxEnergy = quantityValue(params.maxEnergyWattHours, 'Wh', units);
        if (maxEnergy !== undefined) command.maxEnergyWattHours = decimal(maxEnergy);
        const maxSeconds = quantityValue(params.maxSessionSeconds, 's', units);
        if (maxSeconds !== undefined) command.maxSessionSeconds = decimal(maxSeconds);
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(op) {
        const command = commandOf(op);
        return deriveChargingEffects({
          resource: resourceFor(command.connectorId),
          maxPowerWatts: String(command.maxPowerWatts),
          ...(command.maxEnergyWattHours !== undefined
            ? { maxEnergyWattHours: String(command.maxEnergyWattHours) }
            : {}),
          ...(command.maxSessionSeconds !== undefined
            ? { maxSessionSeconds: String(command.maxSessionSeconds) }
            : {}),
          profileId: String(command.profileId),
          profileDigest: profileDigest(command) ?? 'none',
        });
      },
      async actuate(op) {
        const command = commandOf(op);
        const response = await transport.setChargingProfile({
          connectorId: command.connectorId,
          profileId: numberParameter(command.profileId),
          maxPowerWatts: String(command.maxPowerWatts),
          ...(command.maxEnergyWattHours !== undefined
            ? { maxEnergyWattHours: String(command.maxEnergyWattHours) }
            : {}),
          ...(command.maxSessionSeconds !== undefined
            ? { maxSessionSeconds: String(command.maxSessionSeconds) }
            : {}),
        });
        return acceptedResult(response);
      },
      async: { confirmation: 'completed' },
    },
    {
      kind: 'charging:reserveConnector',
      description: 'Reserve a connector for a bounded window before a session starts.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true },
          { name: 'idTag', type: 'string', required: true },
          { name: 'reservationId', type: 'number', required: true },
          {
            name: 'expiresInSeconds', type: 'quantity', required: true,
            dimension: 'time', unit: 's',
          },
        ],
        context: [],
      },
      // A reservation that cannot be proven is refused; the window is bounded.
      policy: { failureMode: 'fail-closed', timeoutMs: 30_000 },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const expiresInSeconds = quantityValue(params.expiresInSeconds, 's', units);
        if (expiresInSeconds === undefined) {
          throw new OcppTransportError('Invalid', 'expiresInSeconds is required');
        }
        const command: ChargingCommand = {
          action: 'ReserveNow',
          connectorId,
          idTag: stringParameter(params.idTag),
          reservationId: numberParameter(params.reservationId),
          expiresInSeconds: decimal(expiresInSeconds),
        };
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(op) {
        const command = commandOf(op);
        return {
          spends: [],
          physical: {
            duration: [{ resource: resourceFor(command.connectorId), seconds: String(command.expiresInSeconds) }],
          },
        };
      },
      async actuate(op) {
        const command = commandOf(op);
        const response = await transport.reserveNow({
          connectorId: command.connectorId,
          idTag: String(command.idTag),
          reservationId: numberParameter(command.reservationId),
          expiresInSeconds: Number(command.expiresInSeconds),
        });
        return acceptedResult(response);
      },
      async: { confirmation: 'completed' },
    },
    {
      kind: 'charging:clearProfile',
      description: 'Clear a charging profile from a connector.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true },
          { name: 'profileId', type: 'number', required: false },
        ],
        context: [],
      },
      policy: { failureMode: 'fail-safe', timeoutMs: 30_000 },
      safeState: async (op) => {
        const command = commandOf(op);
        return clearProfile(command.connectorId, Number(command.profileId ?? 0));
      },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const command: ChargingCommand = { action: 'ClearChargingProfile', connectorId };
        if (params.profileId !== undefined) command.profileId = numberParameter(params.profileId);
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(op) {
        const command = commandOf(op);
        return { spends: [], physical: { power: [{ resource: resourceFor(command.connectorId), watts: '0' }] } };
      },
      async actuate(op) {
        const command = commandOf(op);
        const response = await transport.clearChargingProfile({
          connectorId: command.connectorId,
          ...(command.profileId !== undefined
            ? { profileId: numberParameter(command.profileId) }
            : {}),
        });
        return acceptedResult(response);
      },
      async: { confirmation: 'completed' },
    },
    {
      kind: 'charging:readMeter',
      description: 'Read the charger meter values for a connector or transaction.',
      version: 1,
      capability: 'industrial:read',
      effect: 'read',
      protocol: OCPP_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'connectorId', type: 'number', required: true },
          { name: 'transactionId', type: 'number', required: false },
        ],
        context: [],
      },
      async prepare(params) {
        const connectorId = numberParameter(params.connectorId);
        findConnector(options, connectorId);
        const command: ChargingCommand = { action: 'MeterValues', connectorId };
        if (params.transactionId !== undefined) {
          command.transactionId = numberParameter(params.transactionId);
        }
        return { resourceId: resourceFor(connectorId), command };
      },
      deriveEffects(): StepEffects {
        return { spends: [] };
      },
      async actuate(op) {
        const command = commandOf(op);
        const readings = await transport.readMeterValues({
          connectorId: command.connectorId,
          ...(command.transactionId !== undefined
            ? { transactionId: numberParameter(command.transactionId) }
            : {}),
        });
        return { ok: true, data: { readings } };
      },
    },
  ];

  // Capability-gated definitions are not selectable when the negotiated set
  // does not include them (RFC-024 §5.8); registration fails closed.
  for (const definition of definitions) {
    const capability = options.capabilities;
    if (capability && !capability.profiles.includes(definition.kind)) {
      throw new Error(
        `OCPP ${capability.version} does not provide '${definition.kind}'; refusing to register a capability-gated definition`,
      );
    }
  }

  async function stopSession(connectorId: number, transactionId: number): Promise<EdgeOperationResult> {
    const response = await transport.remoteStopTransaction({ connectorId, transactionId });
    return acceptedResult(response);
  }

  async function clearProfile(connectorId: number, profileId: number): Promise<EdgeOperationResult> {
    const response = await transport.clearChargingProfile({
      connectorId,
      ...(profileId > 0 ? { profileId } : {}),
    });
    return acceptedResult(response);
  }

  return definitions;
}

export function errorCodeOf(error: unknown): string | undefined {
  return error instanceof OcppTransportError ? error.code : undefined;
}

export type { ChargingCommand };
