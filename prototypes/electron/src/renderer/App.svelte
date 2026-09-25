<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { BrowserState } from '../shared/types';
  import TabPanel from './components/TabPanel.svelte';
  import Toolbar from './components/Toolbar.svelte';

  const COLLAPSED_WIDTH = 48;
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 420;
  const DEFAULT_WIDTH = 264;
  /** Keep the page on its own card in both opaque and glass windows. */
  const PAGE_INSET = 8;
  const PAGE_RADIUS = 12;
  const PREFS_KEY = 'yalqen:panel';
  const DEVICE_BEZEL = 10;

  let browser: BrowserState = $state({
    tabs: [],
    activeTabId: null,
    totalMemoryMB: null,
    addressPlaceholder: 'Ara veya adres yaz',
    panelCollapsed: false,
    material: 'opaque',
    device: null,
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

  $effect(() => {
    document.documentElement.dataset.material = browser.material;
  });

  $effect(() => {
    window.yalqen.setLayout({ panelWidth, windowControls: !collapsed, pageInset: PAGE_INSET, pageRadius: PAGE_RADIUS });
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
    style:margin="{PAGE_INSET}px 0 {PAGE_INSET}px {PAGE_INSET}px"
    style:border-radius="{PAGE_RADIUS}px"
  >
    {#if browser.device}
      {@const device = browser.device}
      <div class="device-label" style:left="{device.x - DEVICE_BEZEL}px" style:top="{device.y - DEVICE_BEZEL - 20}px" style:width="{device.viewWidth + 2 * DEVICE_BEZEL}px">
        {device.label} · {device.width}×{device.height}{device.scale < 1 ? ` · %${Math.round(device.scale * 100)}` : ''}
      </div>
      <div
        class="device"
        style:left="{device.x - DEVICE_BEZEL}px"
        style:top="{device.y - DEVICE_BEZEL}px"
        style:width="{device.viewWidth + 2 * DEVICE_BEZEL}px"
        style:height="{device.viewHeight + 2 * DEVICE_BEZEL}px"
        style:border-radius="{Math.round(device.cornerRadius * device.scale) + DEVICE_BEZEL}px"
      ></div>
    {/if}
  </main>
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
    position: relative;
    overflow: hidden;
    background: var(--page);
    box-shadow: var(--page-shadow);
  }

  .device {
    position: absolute;
    background: #1d1d1b;
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.18), 0 0 0 1px rgb(0 0 0 / 0.2);
  }

  .device-label {
    position: absolute;
    height: 16px;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-size-small);
    line-height: 16px;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
