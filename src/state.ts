import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_TEMPLATE,
  getTemplateUrl,
  STATE_DIR,
  STATE_FILE,
} from './constants.js';
import type { RuntimeConfig, SetupState } from './types.js';

export function readExistingState(targetDir: string): SetupState {
  const statePath = path.join(targetDir, STATE_DIR, STATE_FILE);
  if (!fs.existsSync(statePath)) {
    throw new Error(`Could not find setup state: ${statePath}`);
  }

  return normalizeState(
    JSON.parse(fs.readFileSync(statePath, 'utf8')) as SetupState
  );
}

export function readState(
  targetDir: string,
  fallbackConfig: RuntimeConfig
): SetupState {
  const statePath = path.join(targetDir, STATE_DIR, STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return writeState(targetDir, {
      completedSteps: [],
      config: fallbackConfig,
      updatedAt: new Date().toISOString(),
    });
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as SetupState;
  return normalizeState({
    ...state,
    config: {
      ...fallbackConfig,
      ...state.config,
      githubRepo: state.config.githubRepo || fallbackConfig.githubRepo,
      kvNamespaceName:
        state.config.kvNamespaceName || fallbackConfig.kvNamespaceName,
      kvNamespaceId: state.config.kvNamespaceId || fallbackConfig.kvNamespaceId,
    },
  });
}

export function writeState(targetDir: string, state: SetupState): SetupState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  const statePath = path.join(targetDir, STATE_DIR, STATE_FILE);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function markCompleted(
  targetDir: string,
  state: SetupState,
  step: string
): SetupState {
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];
  const next = {
    ...state,
    completedSteps,
    updatedAt: new Date().toISOString(),
  };

  if (!fs.existsSync(targetDir)) {
    return next;
  }

  return writeState(targetDir, next);
}

function normalizeState(state: SetupState): SetupState {
  const template = state.config.template || DEFAULT_TEMPLATE;
  return {
    ...state,
    config: {
      ...state.config,
      githubRepo: state.config.githubRepo || state.config.projectName,
      template,
      templateUrl: state.config.templateUrl || getTemplateUrl(template),
    },
  };
}
