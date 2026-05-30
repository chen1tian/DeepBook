import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { LocationNode, LocationConnection, LocationNetwork } from "./location-types";

export type { LocationNode, LocationConnection, LocationNetwork };

const DATA_DIR = join(process.cwd(), ".data");
const LOCATIONS_DIR = join(DATA_DIR, "locations");

function ensureDir() {
  if (!existsSync(LOCATIONS_DIR)) mkdirSync(LOCATIONS_DIR, { recursive: true });
}

function filePath(dialogueId: string): string {
  return join(LOCATIONS_DIR, `${dialogueId}.json`);
}

export function getDefaultLocationNetwork(): LocationNetwork {
  return {
    nodes: [],
    connections: [],
    currentNodeId: null,
    lastAnalyzedAt: "",
  };
}

export function getLocationNetwork(dialogueId: string): LocationNetwork {
  ensureDir();
  const fp = filePath(dialogueId);
  if (!existsSync(fp)) return getDefaultLocationNetwork();
  try {
    return JSON.parse(readFileSync(fp, "utf-8")) as LocationNetwork;
  } catch {
    return getDefaultLocationNetwork();
  }
}

export function saveLocationNetwork(dialogueId: string, network: LocationNetwork): void {
  ensureDir();
  writeFileSync(filePath(dialogueId), JSON.stringify(network, null, 2), "utf-8");
}

export function deleteLocationNetwork(dialogueId: string): void {
  const fp = filePath(dialogueId);
  if (existsSync(fp)) {
    try { require("fs").unlinkSync(fp); } catch { /* */ }
  }
}
