import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { PlotState, PlotLine } from "./plot-state-types";

// re-export types
export type { PlotState, PlotLine, PlotNode } from "./plot-state-types";

const DATA_DIR = join(process.cwd(), ".data");
const PLOT_DIR = join(DATA_DIR, "plot-states");

function ensureDir() {
  if (!existsSync(PLOT_DIR)) mkdirSync(PLOT_DIR, { recursive: true });
}

function statePath(dialogueId: string): string {
  return join(PLOT_DIR, `${dialogueId}.json`);
}

export function getDefaultPlotState(): PlotState {
  return {
    plotLines: [],
    lastAnalyzedAt: "",
    lastGeneratedAt: "",
  };
}

export function getPlotState(dialogueId: string): PlotState {
  ensureDir();
  const fp = statePath(dialogueId);
  if (!existsSync(fp)) return getDefaultPlotState();
  try {
    return JSON.parse(readFileSync(fp, "utf-8")) as PlotState;
  } catch {
    return getDefaultPlotState();
  }
}

export function savePlotState(dialogueId: string, state: PlotState): void {
  ensureDir();
  writeFileSync(statePath(dialogueId), JSON.stringify(state, null, 2), "utf-8");
}

export function deletePlotState(dialogueId: string): void {
  const fp = statePath(dialogueId);
  if (existsSync(fp)) {
    try { require("fs").unlinkSync(fp); } catch { /* */ }
  }
}
