import { POSTFX_PRESETS, PostProcessingPass } from "@graphics/postprocessing/index.ts";
import type { PostFxConfig } from "@graphics/postprocessing/types.ts";
import {
  NoToneMapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { PassContext } from "../pipeline/Pass.interface.ts";
import type { FrameTiming } from "../types/Frame.type.ts";
import type { UniverseBase } from "../universes/Universe.base.ts";

export default class Output {
  private readonly _renderer: WebGLRenderer;
  private readonly _viewportSize = new Vector2();
  private readonly _activeUniverses = new Set<UniverseBase<string>>();
  private readonly _lifecycleToken = new WeakMap<UniverseBase<string>, number>();
  private readonly _postFxPass: PostProcessingPass;
  private readonly _finalCorrectionPass: PostProcessingPass;
  private _postFxEnabled = true;
  private _finalCorrectionEnabled = true;

  constructor(renderer: WebGLRenderer) {
    this._renderer = renderer;
    this._postFxPass = new PostProcessingPass(POSTFX_PRESETS.medium);
    const finalCorrectionConfig: PostFxConfig = {
      enabled: true,
      final: {
        enabled: true,
        noise: 0,
        grainScale: 1,
        blend: "normal",
        vignetteCenter: { x: 0.5, y: 0.5 },
        vignetteRadius: 1,
        vignetteStrength: 0,
        vignettePower: 1,
        vignetteColor: { r: 0, g: 0, b: 0 },
      },
      bloom: {
        enabled: false,
        intensity: 0,
        threshold: 1,
        radius: 0,
      },
    };
    this._finalCorrectionPass = new PostProcessingPass(finalCorrectionConfig);
  }

  get renderer(): WebGLRenderer {
    return this._renderer;
  }

  get postFxPass(): PostProcessingPass {
    return this._postFxPass;
  }

  getActiveUniverses(): UniverseBase<string>[] {
    return Array.from(this._activeUniverses);
  }

  setPostFxEnabled(enabled: boolean): void {
    this._postFxEnabled = enabled;
  }

  setFinalCorrectionEnabled(enabled: boolean): void {
    this._finalCorrectionEnabled = enabled;
  }

  setPostFxGrainTexture(texture: Texture | null): void {
    this._postFxPass.setGrainTexture(texture);
  }

  private _bumpToken(u: UniverseBase<string>): number {
    const next = (this._lifecycleToken.get(u) ?? 0) + 1;
    this._lifecycleToken.set(u, next);
    return next;
  }

  async activateUniverse(u: UniverseBase<string>): Promise<void> {
    if (this._activeUniverses.has(u)) return;

    const token = this._bumpToken(u);
    u.active = true;
    this._activeUniverses.add(u);
    if (u.mounted) return;

    try {
      await Promise.resolve(u.beforeMount());
    } catch (error) {
      console.error("[Output] beforeMount failed:", error);
      if (this._lifecycleToken.get(u) !== token) return;
      this._activeUniverses.delete(u);
      u.active = false;
      return;
    }

    if (!u.active) return;
    if (!this._activeUniverses.has(u)) return;
    if (this._lifecycleToken.get(u) !== token) return;
    u.onMounted();
    u.markMounted();
  }

  async deactivateUniverse(u: UniverseBase<string>): Promise<void> {
    if (!this._activeUniverses.has(u)) return;

    const token = this._bumpToken(u);
    this._activeUniverses.delete(u);
    u.active = false;
    if (!u.mounted) return;

    try {
      await Promise.resolve(u.beforeUnmount());
    } catch (error) {
      console.error("[Output] beforeUnmount failed:", error);
      return;
    }

    if (u.active) return;
    if (this._activeUniverses.has(u)) return;
    if (this._lifecycleToken.get(u) !== token) return;
    u.onUnmounted();
    u.markUnmounted();
  }

  update(time: number, dt: number): void {
    for (const u of this._activeUniverses) {
      if (u.mounted) u.update(time, dt);
    }
  }

  render(frame: FrameTiming): void {
    const activeMounted = Array.from(this._activeUniverses).filter((u) => u.mounted);
    if (activeMounted.length === 0) return;
    this._prepareRendererState();
    this._renderer.clear(true, true, true);

    if (this._postFxEnabled) {
      const primary = activeMounted.at(-1);
      if (!primary) return;
      const ctx: PassContext = {
        scene: primary.scene,
        camera: primary.camera,
        renderer: this._renderer,
      };
      this._postFxPass.render(frame, ctx);
      return;
    }

    if (this._finalCorrectionEnabled) {
      const primary = activeMounted.at(-1);
      if (!primary) return;
      const ctx: PassContext = {
        scene: primary.scene,
        camera: primary.camera,
        renderer: this._renderer,
      };
      this._finalCorrectionPass.render(frame, ctx);
      return;
    }

    for (const u of this._activeUniverses) {
      if (!u.mounted) continue;
      const ctx: PassContext = {
        scene: u.scene,
        camera: u.camera,
        renderer: this._renderer,
      };
      u.getPipeline().render(frame, ctx);
    }
  }

  private _prepareRendererState(): void {
    this._renderer.outputColorSpace = SRGBColorSpace;
    this._renderer.toneMapping = NoToneMapping;
    this._renderer.toneMappingExposure = 1;

    this._renderer.getSize(this._viewportSize);
    const width = this._viewportSize.x;
    const height = this._viewportSize.y;
    if (width <= 0 || height <= 0) return;

    this._renderer.setScissorTest(false);
    this._renderer.setViewport(0, 0, width, height);
    this._renderer.setScissor(0, 0, width, height);
  }

  resize(width: number, height: number): void {
    this._postFxPass.resize(width, height);
    this._finalCorrectionPass.resize(width, height);
    for (const u of this._activeUniverses) {
      if (u.mounted) u.resize(width, height);
    }
  }

  dispose(): void {
    this._postFxPass.dispose();
    this._finalCorrectionPass.dispose();
  }
}
