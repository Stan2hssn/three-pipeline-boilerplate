import { WebGLRenderer, type Texture, type WebGLRendererParameters } from "three";
import {
  ASSET_KEYS,
  ASSET_MANIFEST,
  type AppAssetManifest,
} from "../../graphics/assets/assets.manifest.ts";
import { DEBUG_CONFIG } from "../../graphics/debug/debug.config.ts";
import { FOLDER_ID, TAB_ID } from "../../graphics/debug/Debug.id.ts";
import type { UniverseId } from "../../graphics/universes/Universe.id.ts";
import { UNIVERSE_MANIFEST } from "../../graphics/universes/universes.manifest.ts";
import type { AssetStore } from "../assets/AssetStore.ts";
import { createAssetStore } from "../assets/index.ts";
import { debug, type DebugManager } from "../debug/index.ts";
import { UniverseRegistry } from "../registries/UniverseRegistry/UniverseRegistry.ts";
import { StatsManager } from "../stats/index.ts";
import Runtime from "./Runtime.ts";
import State from "./State.ts";

export interface IThreeDeviceSlice {
  renderer: WebGLRenderer;
  assets: AssetStore<AppAssetManifest>;
  debug: DebugManager;
  stats: StatsManager;
}

/**
 * ThreeDevice - Creates canvas + WebGLRenderer, Runtime from _core,
 * registers manifest, activates initial universes.
 */
export default class ThreeDevice implements IThreeDeviceSlice {
  private readonly _canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly assets: AssetStore<AppAssetManifest>;
  readonly debug: DebugManager;
  readonly stats: StatsManager;
  private readonly _state: State;
  private readonly _registry: UniverseRegistry<UniverseId>;
  private readonly _runtime: Runtime<UniverseId>;
  private _debugUnsubscribeStats: (() => void) | null = null;
  private readonly _onViewportChange = (): void => {
    this.resize(this._canvas.clientWidth, this._canvas.clientHeight);
  };
  private _eventsBound = false;
  private _disposed = false;

  constructor(canvas: HTMLCanvasElement, config?: WebGLRendererParameters) {
    this._canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      ...config,
    });
    this.renderer.setPixelRatio(
      Math.min(globalThis.window?.devicePixelRatio ?? 1, 2)
    );
    this.assets = createAssetStore(ASSET_MANIFEST);
    this.debug = debug;
    this.stats = new StatsManager(this.renderer);

    this._state = new State();
    this._registry = new UniverseRegistry<UniverseId>();

    for (const { id, ctor, isDefault } of UNIVERSE_MANIFEST) {
      this._registry.define(id, () => new ctor(this), isDefault);
    }

    this._runtime = new Runtime<UniverseId>(
      this.renderer,
      this._registry,
      this._state
    );
    this._runtime.raf.setStats(this.stats);
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get runtime(): Runtime<UniverseId> {
    return this._runtime;
  }

  get state(): State {
    return this._state;
  }

  static async create(
    canvas: HTMLCanvasElement,
    config?: WebGLRendererParameters
  ): Promise<ThreeDevice> {
    const device = new ThreeDevice(canvas, config);
    await device.init();
    return device;
  }

  async init(): Promise<void> {
    this._state.setViewport(this._canvas.clientWidth, this._canvas.clientHeight);
    this.renderer.setSize(this._canvas.clientWidth, this._canvas.clientHeight, false);
    await this.assets.preloadGroup("boot");

    const grainTexture = this.assets.get<Texture>(ASSET_KEYS.postfx.grainTexture);
    this._runtime.output.setPostFxGrainTexture(grainTexture ?? null);

    this._runtime.init();
    this.debug.init(DEBUG_CONFIG);
    this._bindDebugControls();

    const defaultId = this._registry.getDefaultId();
    if (defaultId) await this._runtime.activateUniverse(defaultId);

    this._handleEvents();

    this.start();
  }

  private _handleEvents(): void {
    if (this._eventsBound) return;
    globalThis.addEventListener("resize", this._onViewportChange, true);
    globalThis.addEventListener("orientationchange", this._onViewportChange, true);
    this._eventsBound = true;
  }

  private _bindDebugControls(): void {
    this._debugUnsubscribeStats?.();
    this._debugUnsubscribeStats = this.debug.subscribe({
      ownerId: "three-device-stats",
      tabId: TAB_ID.RENDER,
      folderId: FOLDER_ID.STATS,
      mount: (target) => {
        const params = {
          basic: this.stats.basicEnabled,
          perf: this.stats.perfEnabled,
        };

        const basicBinding = target.addBinding(params, "basic", { label: "Stats GL" });
        basicBinding.on("change", async (event: { value: boolean }) => {
          await this.stats.setBasicEnabled(event.value);
          params.basic = this.stats.basicEnabled;
          basicBinding.refresh();
        });

        const perfBinding = target.addBinding(params, "perf", { label: "Three Perf" });
        perfBinding.on("change", async (event: { value: boolean }) => {
          await this.stats.setPerfEnabled(event.value);
          params.perf = this.stats.perfEnabled;
          perfBinding.refresh();
        });

        void this.stats.setBasicEnabled(params.basic).then(() => {
          params.basic = this.stats.basicEnabled;
          basicBinding.refresh();
        });
        void this.stats.setPerfEnabled(params.perf).then(() => {
          params.perf = this.stats.perfEnabled;
          perfBinding.refresh();
        });

        return () => {
          basicBinding.dispose();
          perfBinding.dispose();
        };
      },
    });
  }

  start(): void {
    this._runtime.start();
  }

  stop(): void {
    this._runtime.stop();
  }

  setDebugEnabled(enabled: boolean): void {
    this.debug.setVisible(enabled);
  }

  toggleDebug(): void {
    this.debug.toggle();
  }

  async setStatsEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.stats.enable();
      return;
    }
    this.stats.disable();
  }

  async toggleStats(): Promise<boolean> {
    return this.stats.toggle();
  }

  async setBasicStatsEnabled(enabled: boolean): Promise<void> {
    await this.stats.setBasicEnabled(enabled);
  }

  async setPerfStatsEnabled(enabled: boolean): Promise<void> {
    await this.stats.setPerfEnabled(enabled);
  }

  resize(width: number, height: number): void {
    this._state.setViewport(width, height);
    this.renderer.setSize(width, height, false);
    this._runtime.resize(width, height);
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    if (this._eventsBound) {
      globalThis.removeEventListener("resize", this._onViewportChange, true);
      globalThis.removeEventListener(
        "orientationchange",
        this._onViewportChange,
        true
      );
      this._eventsBound = false;
    }

    this._runtime.dispose();
    this._debugUnsubscribeStats?.();
    this._debugUnsubscribeStats = null;
    this.debug.dispose();
    this.stats.dispose();
    this.assets.disposeAll();
    this.renderer.dispose();
  }
}
