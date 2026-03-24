import { createShaderKeys, createShaderStore, defineShaders } from "@_core/shaders/index.ts";
import fishInstanceFishTestVertex from "../nodes/aquarium/shader/fish.instance.fishTest.vert?raw";
import fishTestFragment from "../nodes/shaderTest/fishTest.frag";
import fishTestVertex from "../nodes/shaderTest/fishTest.vert";
import finalFragment from "../postprocessing/effects/shaders/final.frag?raw";

export const SHADER_MANIFEST = defineShaders({
  postfx: {
    finalFragment,
  },
  aquarium: {
    fishInstance: {
      vertex: fishInstanceFishTestVertex,
      fragment: fishTestFragment,
    },
  },
  shaderTest: {
    fishTest: {
      vertex: fishTestVertex,
      fragment: fishTestFragment,
    },
  },
} as const);

export const SHADER_KEYS = createShaderKeys(SHADER_MANIFEST);
export const SHADERS = createShaderStore(SHADER_MANIFEST);

export type AppShaderManifest = typeof SHADER_MANIFEST;
