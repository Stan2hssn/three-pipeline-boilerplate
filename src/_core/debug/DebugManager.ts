import { Pane, type FolderApi, type TabPageApi } from "tweakpane";
import type {
  DebugConfig,
  DebugSubscriptionOptions,
} from "./types.ts";

type InternalSubscription = DebugSubscriptionOptions & {
  key: number;
  cleanup: (() => void) | null;
};

function byOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export class DebugManager {
  private _pane: Pane | null = null;
  private _config: DebugConfig | null = null;
  private _visible = true;
  private _nextSubKey = 1;
  private _subscriptions = new Map<number, InternalSubscription>();
  private _tabApis = new Map<string, TabPageApi>();
  private _folderApis = new Map<string, FolderApi>();
  private _knownTabIds = new Set<string>();
  private _knownFolderIds = new Set<string>();
  private _isInitialized = false;

  init(config: DebugConfig): void {
    if (this._isInitialized) return;
    this._isInitialized = true;
    this._config = config;
    this._createPane();
    this._buildTree();
    this._mountAllVisibleSubscriptions();
  }

  setConfig(config: DebugConfig): void {
    this._config = config;
    if (!this._isInitialized) return;
    this._unmountAllSubscriptions();
    this._buildTree();
    this._mountAllVisibleSubscriptions();
  }

  subscribe(options: DebugSubscriptionOptions): () => void {
    const key = this._nextSubKey++;
    const sub: InternalSubscription = { ...options, key, cleanup: null };
    this._subscriptions.set(key, sub);

    if (this._isInitialized) {
      this._mountSubscriptionIfVisible(sub);
    }

    return () => {
      const current = this._subscriptions.get(key);
      if (!current) return;
      current.cleanup?.();
      this._subscriptions.delete(key);
    };
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    if (!this._pane?.element) return;
    const root = this._pane.element.closest(".tp-dfwv") as HTMLElement | null;
    const target = root ?? this._pane.element;
    target.style.display = visible ? "block" : "none";
  }

  toggle(): void {
    this.setVisible(!this._visible);
  }

  dispose(): void {
    this._unmountAllSubscriptions();
    this._subscriptions.clear();
    this._tabApis.clear();
    this._folderApis.clear();
    this._knownTabIds.clear();
    this._knownFolderIds.clear();
    if (this._pane) {
      this._pane.dispose();
      this._pane = null;
    }
    this._isInitialized = false;
  }

  private _createPane(): void {
    if (this._pane) {
      this._pane.dispose();
      this._pane = null;
    }

    this._pane = new Pane({
      title: "Debug",
      expanded: true,
      container: document.body,
    });

    const root = this._pane.element.closest(".tp-dfwv") as HTMLElement | null;
    const target = root ?? this._pane.element;
    target.style.position = "fixed";
    target.style.top = "10px";
    target.style.right = "10px";
    target.style.zIndex = "10000";
    target.style.maxHeight = "80vh";
    target.style.overflow = "auto";
    target.style.minWidth = "320px";
    target.style.display = this._visible ? "block" : "none";
  }

  private _buildTree(): void {
    if (!this._pane || !this._config) return;

    this._createPane();
    this._tabApis.clear();
    this._folderApis.clear();
    this._knownTabIds.clear();
    this._knownFolderIds.clear();

    const visibleTabs = byOrder(this._config.tabs).filter((tab) => tab.visible);
    const tabsById = new Map(this._config.tabs.map((tab) => [tab.id, tab]));
    const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id));

    for (const tab of this._config.tabs) {
      this._knownTabIds.add(tab.id);
    }
    for (const folder of this._config.folders) {
      this._knownFolderIds.add(folder.id);
    }

    if (visibleTabs.length === 0) return;

    const tabApi = this._pane.addTab({
      pages: visibleTabs.map((tab) => ({ title: tab.label })),
    });

    visibleTabs.forEach((tab, index) => {
      this._tabApis.set(tab.id, tabApi.pages[index]);
    });

    const visibleFolders = byOrder(this._config.folders).filter(
      (folder) => folder.visible && visibleTabIds.has(folder.tabId)
    );

    for (const folder of visibleFolders) {
      const tab = tabsById.get(folder.tabId);
      if (!tab) continue;
      const page = this._tabApis.get(tab.id);
      if (!page) continue;
      const folderApi = page.addFolder({
        title: folder.label,
        expanded: folder.expanded ?? true,
      });
      this._folderApis.set(folder.id, folderApi);
    }
  }

  private _mountAllVisibleSubscriptions(): void {
    for (const sub of this._subscriptions.values()) {
      this._mountSubscriptionIfVisible(sub);
    }
  }

  private _unmountAllSubscriptions(): void {
    for (const sub of this._subscriptions.values()) {
      sub.cleanup?.();
      sub.cleanup = null;
    }
  }

  private _mountSubscriptionIfVisible(sub: InternalSubscription): void {
    if (sub.cleanup) return;

    if (!this._knownTabIds.has(sub.tabId)) {
      console.warn(`[debug] Unknown tabId "${sub.tabId}" from "${sub.ownerId}"`);
      return;
    }

    let target: TabPageApi | FolderApi | undefined = this._tabApis.get(sub.tabId);

    if (sub.folderId) {
      if (!this._knownFolderIds.has(sub.folderId)) {
        console.warn(`[debug] Unknown folderId "${sub.folderId}" from "${sub.ownerId}"`);
        return;
      }
      target = this._folderApis.get(sub.folderId);
    }

    if (!target) return;

    const cleanup = sub.mount(target);
    sub.cleanup = typeof cleanup === "function" ? cleanup : null;
  }
}
