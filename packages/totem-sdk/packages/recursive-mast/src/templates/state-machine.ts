/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * State Machine Template — device state transitions with authorization.
 *
 * Use case: edge-modbus (PLC states), edge-opcua (machine states),
 *           edge-bacnet (HVAC modes), edge-matter (device modes)
 *
 * Workflow:
 *   1. Current state is read from PREVSTATE
 *   2. Transition is validated against allowed transitions
 *   3. Authorization is verified (operator + policy)
 *   4. New state is written to STATE
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PrevStateWorkflow, StateTransition } from '../types.js';
import { buildPrevStateWorkflow, buildStateTransition } from '../prevstate.js';

export interface StateMachineConfig {
  /** State machine identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** STATE port for the current state. */
  statePort: number;
  /** Allowed states. */
  states: string[];
  /** Allowed transitions: from → to[]. */
  transitions: Record<string, string[]>;
  /** Initial state. */
  initialState: string;
  /** Operator public key digest (for authorization). */
  operatorPkd?: string;
}

/**
 * Build a KISSVM state machine script.
 *
 * The script:
 *   1. Reads current state from STATE(port)
 *   2. Reads previous state from PREVSTATE(port)
 *   3. Validates the transition is allowed
 *   4. Verifies operator authorization
 *   5. Preserves the new state
 */
export function buildStateMachineScript(config: StateMachineConfig): string {
  const lines: string[] = [
    `// State machine: ${config.name}`,
    `LET oldState = PREVSTATE(${config.statePort})`,
    `LET curState = STATE(${config.statePort})`,
    ``,
    `// Validate transition`,
  ];

  const transitionChecks: string[] = [];
  for (const [from, tos] of Object.entries(config.transitions)) {
    for (const to of tos) {
      transitionChecks.push(`oldState EQ [${from}] AND curState EQ [${to}]`);
    }
  }
  lines.push(`ASSERT ${transitionChecks.join(' OR ')}`);

  if (config.operatorPkd) {
    lines.push(``, `// Operator authorization`, `ASSERT SIGNEDBY(0x${config.operatorPkd})`);
  }

  lines.push(``, `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`, `RETURN TRUE`);

  return lines.join('\n');
}

/**
 * Build a PREVSTATE workflow for a state machine.
 */
export function buildStateMachineWorkflow(config: StateMachineConfig): PrevStateWorkflow {
  const transitions: StateTransition[] = [
    buildStateTransition(
      config.statePort,
      'state',
      'newState',
      'prevState',
      'newState',
    ),
  ];

  return buildPrevStateWorkflow(config.id, config.name, transitions, buildStateMachineScript(config));
}

/**
 * Common state machine templates.
 */

/** On/Off state machine (binary devices: pumps, valves, lights). */
export function onOffStateMachine(
  statePort: number,
  operatorPkd?: string,
): StateMachineConfig {
  return {
    id: 'on-off',
    name: 'On/Off State Machine',
    statePort,
    states: ['OFF', 'ON'],
    transitions: { OFF: ['ON'], ON: ['OFF'] },
    initialState: 'OFF',
    operatorPkd,
  };
}

/** Three-mode state machine (HVAC: off, heat, cool). */
export function hvacStateMachine(
  statePort: number,
  operatorPkd?: string,
): StateMachineConfig {
  return {
    id: 'hvac',
    name: 'HVAC State Machine',
    statePort,
    states: ['OFF', 'HEAT', 'COOL', 'FAN'],
    transitions: {
      OFF: ['HEAT', 'COOL', 'FAN'],
      HEAT: ['OFF', 'FAN'],
      COOL: ['OFF', 'FAN'],
      FAN: ['OFF', 'HEAT', 'COOL'],
    },
    initialState: 'OFF',
    operatorPkd,
  };
}

/** Production line state machine (manufacturing). */
export function productionStateMachine(
  statePort: number,
  operatorPkd?: string,
): StateMachineConfig {
  return {
    id: 'production',
    name: 'Production Line State Machine',
    statePort,
    states: ['IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'MAINTENANCE'],
    transitions: {
      IDLE: ['RUNNING', 'MAINTENANCE'],
      RUNNING: ['PAUSED', 'ERROR', 'IDLE'],
      PAUSED: ['RUNNING', 'IDLE'],
      ERROR: ['IDLE', 'MAINTENANCE'],
      MAINTENANCE: ['IDLE'],
    },
    initialState: 'IDLE',
    operatorPkd,
  };
}

/** Robot arm state machine (ROS 2). */
export function robotArmStateMachine(
  statePort: number,
  operatorPkd?: string,
): StateMachineConfig {
  return {
    id: 'robot-arm',
    name: 'Robot Arm State Machine',
    statePort,
    states: ['HOME', 'MOVING', 'GRIPPING', 'RELEASING', 'ERROR', 'ESTOP'],
    transitions: {
      HOME: ['MOVING'],
      MOVING: ['HOME', 'GRIPPING', 'ERROR', 'ESTOP'],
      GRIPPING: ['MOVING', 'RELEASING', 'ESTOP'],
      RELEASING: ['MOVING', 'HOME', 'ESTOP'],
      ERROR: ['HOME', 'ESTOP'],
      ESTOP: ['HOME'],
    },
    initialState: 'HOME',
    operatorPkd,
  };
}
