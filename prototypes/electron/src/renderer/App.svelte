<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { BrowserState } from '../shared/types';
  import TabPanel from './components/TabPanel.svelte';
  import Toolbar from './components/Toolbar.svelte';

  const COLLAPSED_WIDTH = 48;
  const MIN_WIDTH = 180;
  const MAX_WIDTH = 400;
  const DEFAULT_WIDTH = 240;
  /** Page card inset and radius on glass; on opaque windows the page fills its area. */
  const GLASS_PAGE_INSET = 8;
  const GLASS_PAGE_RADIUS = 10;
  const PREFS_KEY = 'yalqen:panel';

  let browser: BrowserState = $state({
    tabs: [],
    activeTabId: null,
    totalMemoryMB: null,
    addressPlaceholder: 'Ara veya adres yaz',
    panelCollapsed: false,
    material: 'opaque',
  });
  let width = $state(DEFAULT_WIDTH);
  let toolbar: Toolbar;
  // Set while waiting for the main process to expand the panel before focusing the address bar.
  let focusAfterExpand = false;

  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (saved) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved.width) || DEFAULT_WIDTH));
    }
  } catch {
    // Preferences are optional.
  }

  const activeTab = $derived(browser.tabs.find((tab) => tab.id === browser.activeTabId) ?? null);
  // Collapsed state is a setting kept by the main process; width is a local convenience.
  const collapsed = $derived(browser.panelCollapsed);
  const panelWidth = $derived(collapsed ? COLLAPSED_WIDTH : width);
  const glass = $derived(browser.material === 'glass');
  const pageInset = $derived(glass ? GLASS_PAGE_INSET : 0);
  const pageRadius = $derived(glass ? GLASS_PAGE_RADIUS : 0);

  $effect(() => {
    document.documentElement.dataset.material = browser.material;
  });

  $effect(() => {
    window.yalqen.setLayout({ panelWidth, windowControls: !collapsed, pageInset, pageRadius });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ width }));
    } catch {
      // Preferences are optional.
    }
  });

  $effect(() => {
    if (collapsed || !focusAfterExpand) return;
    focusAfterExpand = false;
    void tick().then(() => toolbar.focusAddress());
  });

  function focusAddress(): void {
    if (!collapsed) {
      toolbar.focusAddress();
      return;
    }
    focusAfterExpand = true;
    window.yalqen.send({ type: 'toggle-panel' });
  }

  onMount(() => {
    void window.yalqen.getState().then((next) => (browser = next));
    const offState = window.yalqen.onState((next) => (browser = next));
    const offCommand = window.yalqen.onCommand((command) => {
      if (command.type === 'focus-address') focusAddress();
    });
    return () => {
      offState();
      offCommand();
    };
  });
</script>

<div class="shell" style:grid-template-columns="1fr {panelWidth}px">
  <!-- The page view is drawn by the main process over this area. -->
  <main
    class="page"
    aria-hidden="true"
    style:margin="{pageInset}px 0 {pageInset}px {pageInset}px"
    style:border-radius="{pageRadius}px"
  ></main>
  <TabPanel
    tabs={browser.tabs}
    activeTabId={browser.activeTabId}
    totalMemoryMB={browser.totalMemoryMB}
    {collapsed}
    bind:width
    minWidth={MIN_WIDTH}
    maxWidth={MAX_WIDTH}
    onToggle={() => window.yalqen.send({ type: 'toggle-panel' })}
  >
    {#snippet header()}
      <Toolbar
        bind:this={toolbar}
        tab={activeTab}
        placeholder={browser.addressPlaceholder}
        {collapsed}
        onSearch={focusAddress}
      />
    {/snippet}
  </TabPanel>
</div>

<style>
  .shell {
    display: grid;
    height: 100%;
  }

  .page {
    background: var(--page);
    box-shadow: var(--page-shadow);
  }
</style>
