<script lang="ts">
  import { onMount } from 'svelte';
  import type { BrowserState } from '../shared/types';
  import PageHeader from './components/PageHeader.svelte';
  import TabPanel from './components/TabPanel.svelte';
  import Toolbar from './components/Toolbar.svelte';

  const COLLAPSED_WIDTH = 64;
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 400;
  const DEFAULT_WIDTH = 280;
  /** Top bar height, page card gap to the window edges, card header and radius. */
  const CHROME_HEIGHT = 56;
  const PAGE_INSET = 10;
  const PAGE_HEADER_HEIGHT = 44;
  const PAGE_RADIUS = 14;
  /** Right edge of the macOS traffic lights, measured from the window's left edge. */
  const WINDOW_CONTROLS_END = 80;
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

  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (saved) {
      width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved.width) || DEFAULT_WIDTH));
    }
  } catch {
    // Preferences are optional.
  }

  // Traffic lights are drawn by macOS only.
  const windowControls = navigator.userAgent.includes('Macintosh');
  const activeTab = $derived(browser.tabs.find((tab) => tab.id === browser.activeTabId) ?? null);
  // Collapsed state is a setting kept by the main process; width is a local convenience.
  const collapsed = $derived(browser.panelCollapsed);
  const panelWidth = $derived(collapsed ? COLLAPSED_WIDTH : width);

  $effect(() => {
    document.documentElement.dataset.material = browser.material;
  });

  $effect(() => {
    window.yalqen.setLayout({
      panelWidth,
      windowControls: true,
      chromeHeight: CHROME_HEIGHT,
      pageInset: PAGE_INSET,
      pageHeaderHeight: PAGE_HEADER_HEIGHT,
      pageRadius: PAGE_RADIUS,
    });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ width }));
    } catch {
      // Preferences are optional.
    }
  });

  onMount(() => {
    void window.yalqen.getState().then((next) => (browser = next));
    const offState = window.yalqen.onState((next) => (browser = next));
    const offCommand = window.yalqen.onCommand((command) => {
      if (command.type === 'focus-address') window.yalqen.send({ type: 'open-address' });
    });
    return () => {
      offState();
      offCommand();
    };
  });
</script>

<div class="shell" style:grid-template-columns="{panelWidth}px minmax(0, 1fr)" style:grid-template-rows="{CHROME_HEIGHT}px minmax(0, 1fr)">
  <TabPanel
    tabs={browser.tabs}
    activeTabId={browser.activeTabId}
    totalMemoryMB={browser.totalMemoryMB}
    {collapsed}
    {windowControls}
    bind:width
    minWidth={MIN_WIDTH}
    maxWidth={MAX_WIDTH}
    onToggle={() => window.yalqen.send({ type: 'toggle-panel' })}
  />
  <Toolbar
    tabs={browser.tabs}
    activeTabId={browser.activeTabId}
    leadingInset={windowControls ? Math.max(0, WINDOW_CONTROLS_END - panelWidth) : 0}
  />
  <section
    class="page"
    style:margin="0 {PAGE_INSET}px {PAGE_INSET}px 0"
    style:border-radius="{PAGE_RADIUS}px"
  >
    <PageHeader tab={activeTab} height={PAGE_HEADER_HEIGHT} />
    <!-- The page view is drawn by the main process over this area. -->
    <div class="viewport" aria-hidden="true">
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
    </div>
  </section>
</div>

<style>
  .shell {
    display: grid;
    height: 100%;
  }

  .page {
    position: relative;
    display: flex;
    grid-column: 2;
    grid-row: 2;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--page);
    box-shadow: var(--page-shadow);
  }

  .viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--page-empty);
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
