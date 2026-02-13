import type { DebugConfig } from "@_core/debug/index.ts";
import { FOLDER_ID, TAB_ID } from "./Debug.id.ts";

export const DEBUG_CONFIG: DebugConfig = {
  tabs: [
    { id: TAB_ID.UNIVERSE, label: "Universe", visible: true, order: 1 },
    { id: TAB_ID.NODES, label: "Nodes", visible: true, order: 2 },
    { id: TAB_ID.RENDER, label: "Render", visible: false, order: 3 },
  ],
  folders: [
    {
      id: FOLDER_ID.UNIVERSE_MAIN,
      tabId: TAB_ID.UNIVERSE,
      label: "Main Universe",
      visible: true,
      expanded: true,
      order: 1,
    },
    {
      id: FOLDER_ID.NODES_SWAP,
      tabId: TAB_ID.NODES,
      label: "Swap",
      visible: true,
      expanded: true,
      order: 1,
    },
    {
      id: FOLDER_ID.POSTFX,
      tabId: TAB_ID.RENDER,
      label: "PostFX",
      visible: true,
      expanded: true,
      order: 1,
    },
  ],
};
