import type Input from "@_core/systems/Input.ts";
import { gsap } from "gsap";

export class DOMInputAdapter {
  private _canvas: HTMLCanvasElement | null = null;
  private _input: Input | null = null;
  private _onMouseMove: ((event: MouseEvent) => void) | null = null;
  private _onMouseDown: ((event: MouseEvent) => void) | null = null;
  private _onMouseUp: ((event: MouseEvent) => void) | null = null;
  private _onWheel: ((event: WheelEvent) => void) | null = null;
  private readonly _smooth = { x: 0, y: 0, nx: 0, ny: 0 };
  private readonly _setSmoothX = gsap.quickTo(this._smooth, "x", {
    duration: 0.35,
    ease: "power2.out",
  });
  private readonly _setSmoothY = gsap.quickTo(this._smooth, "y", {
    duration: 0.35,
    ease: "power2.out",
  });
  private readonly _setSmoothNX = gsap.quickTo(this._smooth, "nx", {
    duration: 0.35,
    ease: "power2.out",
  });
  private readonly _setSmoothNY = gsap.quickTo(this._smooth, "ny", {
    duration: 0.35,
    ease: "power2.out",
  });
  private readonly _mouseMoveCooldownMs = 420;
  private _mouseMovedTimeout: ReturnType<typeof setTimeout> | null = null;
  private _tickId: number | null = null;
  private _isTicking = false;
  private _lastSourceEvent: MouseEvent | undefined = undefined;

  attach(canvas: HTMLCanvasElement, input: Input): void {
    this.detach();
    this._canvas = canvas;
    this._input = input;

    this._onMouseMove = (event: MouseEvent) => {
      if (!this._canvas || !this._input) return;
      const viewportWidth = this._canvas.clientWidth || globalThis.window?.innerWidth || 1;
      const viewportHeight = this._canvas.clientHeight || globalThis.window?.innerHeight || 1;
      const x = event.clientX;
      const y = event.clientY;
      const nx = (x / viewportWidth) * 2 - 1;
      const ny = -(y / viewportHeight) * 2 + 1;
      this._input.setMousePosition({ x, y, nx, ny, sourceEvent: event });
      this._setSmoothX(x);
      this._setSmoothY(y);
      this._setSmoothNX(nx);
      this._setSmoothNY(ny);
      this._lastSourceEvent = event;
      this._markMouseMoved();
      this._input.emitMouseMove(event);
      this._startTick();
    };

    this._onMouseDown = (event: MouseEvent) => {
      if (!this._input) return;
      const button = event.button === 0 ? "left" : event.button === 1 ? "middle" : "right";
      this._input.setMouseButton(button, true, event);
    };

    this._onMouseUp = (event: MouseEvent) => {
      if (!this._input) return;
      const button = event.button === 0 ? "left" : event.button === 1 ? "middle" : "right";
      this._input.setMouseButton(button, false, event);
    };

    this._onWheel = (event: WheelEvent) => {
      if (!this._input) return;
      this._input.setWheel(event.deltaY, event);
    };

    this._canvas.addEventListener("mousemove", this._onMouseMove);
    this._canvas.addEventListener("mousedown", this._onMouseDown);
    this._canvas.addEventListener("mouseup", this._onMouseUp);
    this._canvas.addEventListener("wheel", this._onWheel, { passive: true });
  }

  detach(): void {
    if (this._canvas && this._onMouseMove) {
      this._canvas.removeEventListener("mousemove", this._onMouseMove);
    }
    if (this._canvas && this._onMouseDown) {
      this._canvas.removeEventListener("mousedown", this._onMouseDown);
    }
    if (this._canvas && this._onMouseUp) {
      this._canvas.removeEventListener("mouseup", this._onMouseUp);
    }
    if (this._canvas && this._onWheel) {
      this._canvas.removeEventListener("wheel", this._onWheel);
    }

    this._onMouseMove = null;
    this._onMouseDown = null;
    this._onMouseUp = null;
    this._onWheel = null;
    this._canvas = null;
    this._input = null;
    this._lastSourceEvent = undefined;
    this._stopTick();
    if (this._mouseMovedTimeout) {
      clearTimeout(this._mouseMovedTimeout);
      this._mouseMovedTimeout = null;
    }
  }

  dispose(): void {
    this.detach();
  }

  private _markMouseMoved(): void {
    if (!this._input) return;
    this._input.setMouseMoved(true);
    if (this._mouseMovedTimeout) {
      clearTimeout(this._mouseMovedTimeout);
    }
    this._mouseMovedTimeout = setTimeout(() => {
      if (!this._input) return;
      this._input.setMouseMoved(false);
      this._mouseMovedTimeout = null;
    }, this._mouseMoveCooldownMs);
  }

  private _startTick(): void {
    if (this._isTicking) return;
    this._isTicking = true;
    this._tick();
  }

  private _stopTick(): void {
    this._isTicking = false;
    if (this._tickId !== null) {
      cancelAnimationFrame(this._tickId);
      this._tickId = null;
    }
  }

  private readonly _tick = (): void => {
    if (!this._isTicking || !this._input) return;

    this._input.setSmoothMousePosition({
      x: this._smooth.x,
      y: this._smooth.y,
      nx: this._smooth.nx,
      ny: this._smooth.ny,
    });

    if (this._input.mouseMoved) {
      this._input.emitMouseMove(this._lastSourceEvent);
      this._tickId = requestAnimationFrame(this._tick);
      return;
    }

    this._stopTick();
  };
}
