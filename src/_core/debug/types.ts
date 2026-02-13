import type { FolderApi, TabPageApi } from "tweakpane";

export type TabId = string;
export type FolderId = string;

export interface DebugTabConfig {
  id: TabId;
  label: string;
  visible: boolean;
  order?: number;
}

export interface DebugFolderConfig {
  id: FolderId;
  tabId: TabId;
  label: string;
  visible: boolean;
  expanded?: boolean;
  order?: number;
}

export interface DebugConfig {
  tabs: DebugTabConfig[];
  folders: DebugFolderConfig[];
}

export type DebugTarget = TabPageApi | FolderApi;

export interface DebugSubscriptionOptions {
  ownerId: string;
  tabId: TabId;
  folderId?: FolderId;
  mount: (target: DebugTarget) => void | (() => void);
}
