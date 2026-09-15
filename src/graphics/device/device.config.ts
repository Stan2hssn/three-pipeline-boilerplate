import type { DeviceConfig } from "@_core/systems/DeviceConfig.type.ts";

/**
 * Ce que ce projet ajoute au device sans toucher au `_core`.
 *
 * Vide dans le template : les defauts du core s'appliquent (pixel ratio 2,
 * `PCFSoftShadowMap`, exposition 1, aucune persistance des reglages). Voir
 * `src/_core/systems/DeviceConfig.type.ts` et `src/_core/README.md`.
 */
export const DEVICE_CONFIG: DeviceConfig = {};
