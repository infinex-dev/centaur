/**
 * Internal fact source: maintained partner / feature registry.
 *
 * Maps product features to the third-party providers powering them.
 * Lives in config/partner-registry.json so it can be updated without
 * a code change. Evidence field cites the platform source that was
 * checked when the entry was verified.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_PATH = resolve(
  fileURLToPath(import.meta.url),
  "../../../../config/partner-registry.json",
);

export interface PartnerRegistryEntry {
  feature: string;
  provider: string;
  provider_handle: string | null;
  evidence: {
    source_ref: string;
    verified_at: string;
  };
}

let _registry: PartnerRegistryEntry[] | null = null;

function loadRegistry(): PartnerRegistryEntry[] {
  if (_registry) return _registry;
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf8");
    _registry = JSON.parse(raw) as PartnerRegistryEntry[];
    return _registry;
  } catch {
    throw new Error(
      `Could not load partner registry at ${REGISTRY_PATH}. Ensure config/partner-registry.json exists.`,
    );
  }
}

/** Look up a feature by exact name. Returns null if not found. */
export function lookupFeature(feature: string): PartnerRegistryEntry | null {
  const registry = loadRegistry();
  return registry.find((e) => e.feature === feature) ?? null;
}

/** Find all entries whose feature name contains the substring. */
export function searchFeatures(substring: string): PartnerRegistryEntry[] {
  const registry = loadRegistry();
  const lower = substring.toLowerCase();
  return registry.filter((e) => e.feature.toLowerCase().includes(lower));
}

/** Return all registry entries. */
export function allFeatures(): PartnerRegistryEntry[] {
  return loadRegistry();
}

/** Reload the registry from disk — useful in tests that swap the file. */
export function _resetRegistryCache(): void {
  _registry = null;
}
