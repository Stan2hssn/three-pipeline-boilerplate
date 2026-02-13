import { DebugManager } from "./DebugManager.ts";

export { DebugManager } from "./DebugManager.ts";
export type {
  DebugConfig,
  DebugFolderConfig,
  DebugSubscriptionOptions,
  DebugTabConfig,
  FolderId,
  TabId,
} from "./types.ts";

export const debug = new DebugManager();
