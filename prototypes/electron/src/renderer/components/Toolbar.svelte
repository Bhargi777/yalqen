<script lang="ts">
  import type { TabId, TabSnapshot } from '../../shared/types';
  import { siteLabel } from '../format';
  import Icon from './Icon.svelte';

  let {
    tabs,
    activeTabId,
    leadingInset,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    /** Space kept free on the left, e.g. for traffic lights over a collapsed sidebar. */
    leadingInset: number;
  } = $props();

  let brokenIcons: Record<string, true> = $state({});
  let strip: HTMLElement | undefined = $state();

  const send = window.yalqen.send;
  const activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) ?? null);

  $effect(() => {
    // Keep the active tab in view when it changes.
    void activeTabId;
    strip?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
</script>

<header class="toolbar" style:padding-left="{leadingInset}px">
  <nav class="group" aria-label="Gezinme">
    <button class="square" title="Yenile" onclick={() => send({ type: 'reload' })}>
      <Icon name="reload" />
    </button>
    <button
      class="square"
      title="Geri"
      disabled={!activeTab?.canGoBack}
      onclick={() => send({ type: 'go-back' })}
    >
      <Icon name="back" />
    </button>
    <button
      class="square"
      title="İleri"
      disabled={!activeTab?.canGoForward}
      onclick={() => send({ type: 'go-forward' })}
    >
      <Icon name="forward" />
    </button>
  </nav>

  <ol class="strip" bind:this={strip} aria-label="Açık sekmeler">
    {#each tabs as tab (tab.id)}
      <li class="chip" class:active={tab.id === activeTabId}>
        <button
          class="chip-select"
          title={tab.title}
          aria-current={tab.id === activeTabId ? 'page' : undefined}
          onclick={() => send({ type: 'activate-tab', id: tab.id })}
          onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
        >
          <span class="favicon">
            {#if tab.faviconUrl && !brokenIcons[tab.faviconUrl]}
              <img
                src={tab.faviconUrl}
                alt=""
                width="18"
                height="18"
                onerror={() => (brokenIcons[tab.faviconUrl!] = true)}
              />
            {:else}
              <Icon name="globe" />
            {/if}
          </span>
          <span class="chip-title">{siteLabel(tab)}</span>
        </button>
        <button class="chip-close" title="Kapat" onclick={() => send({ type: 'close-tab', id: tab.id })}>
          <Icon name="close" size={14} />
        </button>
      </li>
    {/each}
  </ol>

  <button class="square" title="Yeni sekme (⌘T)" onclick={() => send({ type: 'new-tab' })}>
    <Icon name="plus" />
  </button>

  <span class="spacer"></span>

  <span class="group tools">
    <button class="square" title="Ayarlar (⌘,)" aria-label="Ayarlar" onclick={() => send({ type: 'open-settings' })}>
      <Icon name="settings" />
    </button>
  </span>
</header>

<style>
  .toolbar {
    display: flex;
    grid-column: 2;
    grid-row: 1;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding-right: 10px;
    -webkit-app-region: drag;
  }

  .group {
    display: flex;
    flex: none;
    gap: 6px;
  }

  .square {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 11px;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    transition: background var(--transition);
    -webkit-app-region: no-drag;
  }

  .square:hover:not(:disabled) {
    background: var(--surface-strong);
  }

  .square:disabled {
    color: var(--text-muted);
    opacity: 0.55;
  }

  .spacer {
    flex: 1;
    min-width: 12px;
  }

  .strip {
    display: flex;
    flex: 0 1 auto;
    gap: 2px;
    min-width: 0;
    margin: 0;
    padding: 3px;
    overflow-x: auto;
    list-style: none;
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .chip {
    position: relative;
    display: flex;
    /* Tabs keep their width and the strip scrolls, like the design's pills. */
    flex: none;
    align-items: center;
    max-width: 200px;
    height: 38px;
    border-radius: 11px;
    transition: background var(--transition);
    -webkit-app-region: no-drag;
  }

  .chip:hover {
    background: var(--surface-hover);
  }

  .chip.active {
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  :global([data-material='glass']) .chip.active,
  :global([data-material='glass']) .square {
    box-shadow: var(--shadow), var(--rim);
  }

  /* A thin divider between neighbouring inactive tabs. */
  .chip:not(.active) + .chip:not(.active)::before {
    content: '';
    position: absolute;
    top: 11px;
    bottom: 11px;
    left: -2px;
    width: 1px;
    background: var(--border);
  }

  .chip-select {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 9px;
    min-width: 0;
    height: 100%;
    padding: 0 6px 0 11px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--text-muted);
    font-size: 14px;
  }

  .chip.active .chip-select {
    color: var(--text);
  }

  .favicon {
    display: grid;
    flex: none;
    place-items: center;
    width: 18px;
    height: 18px;
    color: var(--text-muted);
  }

  .favicon img {
    width: 18px;
    height: 18px;
    border-radius: 5px;
  }

  .chip-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-close {
    display: grid;
    flex: none;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-right: 7px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    visibility: hidden;
  }

  .chip:hover .chip-close,
  .chip.active .chip-close,
  .chip-close:focus-visible {
    visibility: visible;
  }

  .chip-close:hover {
    background: var(--surface-hover);
  }
</style>
