<script lang="ts">
  import { onMount } from 'svelte';
  import type { BrowserState } from '../shared/types';
  import { isNewTab } from './format';
  import Icon from './components/Icon.svelte';
  import TabPanel from './components/TabPanel.svelte';
  import Toolbar from './components/Toolbar.svelte';

  const COLLAPSED_WIDTH = 44;
  const MIN_WIDTH = 180;
  const MAX_WIDTH = 360;
  const DEFAULT_WIDTH = 220;
  /** Top bar height, page card gap to the right and bottom window edges, card radius. */
  const CHROME_HEIGHT = 44;
  const PAGE_INSET = 8;
  const PAGE_RADIUS = 16;
  /** Where the back and forward capsule starts beside the macOS traffic lights. */
  const WINDOW_CONTROLS_END = 88;
  /** Back and forward capsule: left edge when nothing is before it, width, gap after it. */
  const NAV_START = 8;
  const NAV_WIDTH = 62;
  const NAV_GAP = 6;
  /** New tab and settings capsule: always in the top-right corner, same size as back and forward. */
  const ACTIONS_SPACE = PAGE_INSET + NAV_WIDTH + NAV_GAP;
  // Versioned so the wider sidebar of earlier designs is not restored.
  const PREFS_KEY = 'yalqen:panel:2';
  const DEVICE_BEZEL = 10;

  let browser: BrowserState = $state({
    tabs: [],
    activeTabId: null,
    pageFullScreen: false,
    addressPlaceholder: 'Ara veya adres yaz',
    panelCollapsed: false,
    panelSide: 'left',
    material: 'opaque',
    device: null,
  });
  let width = $state(DEFAULT_WIDTH);
  let controlsShown = $state(false);

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
  const side = $derived(browser.panelSide);
  // The new tab page is an empty board: no card, the page blends into the window.
  const blank = $derived(activeTab !== null && isNewTab(activeTab.url));
  // The back and forward buttons sit in the corner and slide aside for the traffic lights.
  const navStart = $derived(windowControls && controlsShown ? WINDOW_CONTROLS_END : NAV_START);
  const navEnd = $derived(navStart + NAV_WIDTH + NAV_GAP);

  $effect(() => {
    document.documentElement.dataset.material = browser.material;
  });

  $effect(() => {
    window.yalqen.setLayout({
      panelWidth,
      panelSide: side,
      // On macOS the traffic lights stay hidden until the pointer reaches their corner.
      windowControls: !windowControls,
      chromeHeight: CHROME_HEIGHT,
      pageInset: PAGE_INSET,
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
      if (command.type === 'window-controls') controlsShown = command.visible;
    });
    return () => {
      offState();
      offCommand();
    };
  });
</script>

<div
  class="shell"
  class:right={side === 'right'}
  class:fullscreen={browser.pageFullScreen}
  style:grid-template-columns={browser.pageFullScreen ? 'minmax(0, 1fr)' : side === 'left' ? `${panelWidth}px minmax(0, 1fr)` : `minmax(0, 1fr) ${panelWidth}px`}
  style:grid-template-rows={browser.pageFullScreen ? 'minmax(0, 1fr)' : `${CHROME_HEIGHT}px minmax(0, 1fr)`}
>
  {#if !browser.pageFullScreen}
  <TabPanel
    tabs={browser.tabs}
    activeTabId={browser.activeTabId}
    {collapsed}
    {windowControls}
    {side}
    leadingInset={side === 'left' ? navEnd : 0}
    trailingInset={side === 'right' ? ACTIONS_SPACE : 0}
    bind:width
    minWidth={MIN_WIDTH}
    maxWidth={MAX_WIDTH}
    onToggle={() => window.yalqen.send({ type: 'toggle-panel' })}
  />
  <Toolbar
    tabs={browser.tabs}
    activeTabId={browser.activeTabId}
    leadingInset={side === 'left' ? Math.max(0, navEnd - panelWidth) : navEnd}
    trailingInset={side === 'left' ? ACTIONS_SPACE : Math.max(0, ACTIONS_SPACE - panelWidth)}
    {blank}
  />
  <nav class="corner navigation" aria-label="Gezinme" style:transform="translateX({navStart}px)">
    <button class="icon" title="Geri" disabled={!activeTab?.canGoBack} onclick={() => window.yalqen.send({ type: 'go-back' })}>
      <Icon name="back" />
    </button>
    <button class="icon" title="İleri" disabled={!activeTab?.canGoForward} onclick={() => window.yalqen.send({ type: 'go-forward' })}>
      <Icon name="forward" />
    </button>
  </nav>
  <div class="corner actions" style:right="{PAGE_INSET}px">
    <button class="icon" title="Yeni sekme (⌘T)" onclick={() => window.yalqen.send({ type: 'new-tab' })}>
      <Icon name="plus" />
    </button>
    <button class="icon" title="Ayarlar (⌘,)" aria-label="Ayarlar" onclick={() => window.yalqen.send({ type: 'open-settings' })}>
      <Icon name="settings" />
    </button>
  </div>
  {#if windowControls}
    <!--
      Reveals the traffic lights. They stay while the pointer is over them or the
      moved buttons; the main process hides them once it leaves.
    -->
    <div
      class="controls-zone"
      class:shown={controlsShown}
      aria-hidden="true"
      onpointerenter={() =>
        window.yalqen.send({ type: 'reveal-window-controls', width: WINDOW_CONTROLS_END + NAV_WIDTH + NAV_GAP })}
    ></div>
  {/if}
  {/if}
  <section
    class="page"
    class:blank
    style:margin={browser.pageFullScreen ? '0' : side === 'left' ? `0 ${PAGE_INSET}px ${PAGE_INSET}px 0` : `0 0 ${PAGE_INSET}px ${PAGE_INSET}px`}
    style:border-radius={browser.pageFullScreen ? '0' : `${PAGE_RADIUS}px`}
  >
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
    grid-template-areas:
      'panel bar'
      'panel page';
    height: 100%;
  }

  .shell.right {
    grid-template-areas:
      'bar panel'
      'page panel';
  }

  .shell.fullscreen,
  .shell.fullscreen.right {
    grid-template-areas: 'page';
  }

  .shell.fullscreen .page {
    box-shadow: none;
  }

  /* Capsules pinned to the top corners, whichever side the panel is on. */
  .corner {
    position: fixed;
    top: 6px;
    z-index: 1;
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    transition: transform 0.2s ease;
    -webkit-app-region: no-drag;
  }

  .navigation {
    left: 0;
  }

  :global([data-material='glass']) .corner {
    box-shadow: var(--shadow), var(--rim);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    transition: background var(--transition);
  }

  .icon:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .icon:disabled {
    color: var(--text-muted);
    opacity: 0.5;
  }

  /* Over the buttons while the traffic lights are hidden, so reaching them reveals the lights. */
  .controls-zone {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2;
    width: 76px;
    height: 44px;
    -webkit-app-region: no-drag;
  }

  .controls-zone.shown {
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .navigation {
      transition: none;
    }
  }

  .page {
    position: relative;
    display: flex;
    grid-area: page;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--page);
    box-shadow: var(--page-shadow);
  }

  .page.blank {
    background: transparent;
    box-shadow: none;
  }

  .page.blank .viewport {
    background: transparent;
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
