import { POSTFX_PRESETS, PostProcessingPass } from "@graphics/postprocessing/index.ts";
import type { Texture, WebGLRenderer } from "three";
import type { PassContext } from "../pipeline/Pass.interface.ts";
import type { FrameTiming } from "../types/Frame.type.ts";
import type { UniverseBase } from "../universes/Universe.base.ts";

export default class Output {
  private readonly _renderer: WebGLRenderer;
  private readonly _activeUniverses = new Set<UniverseBase<string>>();
  private readonly _lifecycleToken = new WeakMap<UniverseBase<string>, number>();
  private readonly _postFxPass: PostProcessingPass;
  private _postFxEnabled = true;

  constructor(renderer: WebGLRenderer) {
    this._renderer = renderer;
    this._postFxPass = new PostProcessingPass(POSTFX_PRESETS.medium);
  }

  get renderer(): WebGLRenderer {
    return this._renderer;
  }

  getActiveUniverses(): UniverseBase<string>[] {
    return Array.from(this._activeUniverses);
  }

  setPostFxEnabled(enabled: boolean): void {
    this._postFxEnabled = enabled;
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

  resize(width: number, height: number): void {
    this._postFxPass.resize(width, height);
    for (const u of this._activeUniverses) {
      if (u.mounted) u.resize(width, height);
    }
  }

  dispose(): void {
    this._postFxPass.dispose();
  }
}
