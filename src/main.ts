/**
 * Bootstrap: ThreeDevice (graphics) → Runtime (_core) → init → start → activate initial universe.
 */

import "./styles/style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#webgl");
const READY_CLASS = "is-three-ready";
const LOADING_CLASS = "is-three-loading";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.requestAnimationFrame(() => resolve());
  });
}

async function onMounted() {
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  document.body.classList.add(LOADING_CLASS);

  try {
    // Let the browser paint initial text/UI before loading heavy 3D modules.
    await nextFrame();

    const { default: ThreeDevice } = await import("./_core/systems/ThreeDevice.ts");
    const device = await ThreeDevice.create(canvas, {
      antialias: true,
      alpha: false,
    });

    document.body.classList.add(READY_CLASS);

    if (
      typeof globalThis.addEventListener === "function" &&
      "PageTransitionEvent" in globalThis
    ) {
      globalThis.addEventListener(
        "pagehide",
        (event: PageTransitionEvent) => {
          if (event.persisted) return;
          device.dispose();
        },
        { once: true }
      );
    }
  } catch (error) {
    console.error("Failed to initialize ThreeDevice:", error);
  } finally {
    document.body.classList.remove(LOADING_CLASS);
  }
}

document.addEventListener("DOMContentLoaded", onMounted, true);
