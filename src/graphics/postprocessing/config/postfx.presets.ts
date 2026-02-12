import type { PostFxConfig, PostFxQuality } from "../types.ts";

export const POSTFX_PRESETS: Record<PostFxQuality, PostFxConfig> = {
  off: {
    enabled: false,
    final: {
      enabled: false,
      noise: 0,
      grainScale: 1,
      blend: "normal",
      vignetteCenter: { x: 0.5, y: 0.5 },
      vignetteRadius: 0.3,
      vignetteStrength: 0,
      vignettePower: 0.8,
      vignetteColor: { r: 0.06, g: 0.07, b: 0.1 },
    },
    bloom: {
      enabled: false,
      intensity: 0,
      threshold: 1,
      radius: 0,
    },
  },
  low: {
    enabled: true,
    final: {
      enabled: true,
      noise: 0.03,
      grainScale: 6,
      blend: "add",
      vignetteCenter: { x: 0.5, y: 0.5 },
      vignetteRadius: 0.3,
      vignetteStrength: 0.12,
      vignettePower: 0.8,
      vignetteColor: { r: 0.06, g: 0.07, b: 0.1 },
    },
    bloom: {
      enabled: true,
      intensity: 0.8,
      threshold: 0.43,
      radius: 0.5,
    },
  },
  medium: {
    enabled: true,
    final: {
      enabled: true,
      noise: 0.038,
      grainScale: 6,
      blend: "add",
      vignetteCenter: { x: 0.5, y: 0.5 },
      vignetteRadius: 0.3,
      vignetteStrength: 0.15,
      vignettePower: 0.8,
      vignetteColor: { r: 0.06, g: 0.07, b: 0.1 },
    },
    bloom: {
      enabled: true,
      intensity: .5,
      threshold: 0.43,
      radius: 0.5,
    },
  },
  high: {
    enabled: true,
    final: {
      enabled: true,
      noise: 0.05,
      grainScale: 6,
      blend: "add",
      vignetteCenter: { x: 0.5, y: 0.5 },
      vignetteRadius: 0.3,
      vignetteStrength: 0.18,
      vignettePower: 0.8,
      vignetteColor: { r: 0.06, g: 0.07, b: 0.1 },
    },
    bloom: {
      enabled: true,
      intensity: 1.2,
      threshold: 0.43,
      radius: 0.5,
    },
  },
};
