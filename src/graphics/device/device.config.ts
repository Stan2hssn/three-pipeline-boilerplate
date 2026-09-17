import type { DeviceConfig } from "@_core/systems/DeviceConfig.type.ts";

/**
 * Ce que ce projet ajoute au device sans toucher au `_core`.
 *
 * Backend WebGPU, exige par le post-traitement TSL. Le reste suit les defauts
 * du core. Voir `src/_core/systems/DeviceConfig.type.ts` et `src/_core/README.md`.
 */
export const DEVICE_CONFIG: DeviceConfig = {
  renderer: { backend: "webgpu" },
};
