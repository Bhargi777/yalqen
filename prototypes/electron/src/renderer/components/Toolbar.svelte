<script lang="ts">
  import type { TabId, TabSnapshot } from '../../shared/types';
  import { isNewTab, siteLabel } from '../format';
  import Icon from './Icon.svelte';

  let {
    tabs,
    activeTabId,
    leadingInset,
    trailingInset,
    blank,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    /** Space kept free on the left for the back and forward buttons over a narrow sidebar. */
    leadingInset: number;
    /** Space kept free on the right, matching the page card's edge. */
    trailingInset: number;
    /** A new tab page is showing; it has its own search field, so the strip steps aside. */
    blank: boolean;
  } = $props();

  let brokenIcons: Record<string, true> = $state({});
  let strip: HTMLElement | undefined = $state();
  const send = window.yalqen.send;

  $effect(() => {
    // Keep the active tab in view when it changes.
    void activeTabId;
    strip?.querySelector('.chip.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
</script>

{#snippet favicon(tab: TabSnapshot)}
  <span class="favicon">
    {#if isNewTab(tab.url)}
      <Icon name="search" size={14} />
    {:else if tab.faviconUrl && !brokenIcons[tab.faviconUrl]}
      <img
        src={tab.faviconUrl}
        alt=""
        width="16"
        height="16"
        onerror={() => (brokenIcons[tab.faviconUrl!] = true)}
      />
    {:else}
      <Icon name="globe" size={14} />
    {/if}
  </span>
{/snippet}

<!--
  Safari-like: capsules on the window background. The active tab doubles as the
  address field: clicking it opens the centered address bar.
-->
<header class="toolbar" style:padding-left="{leadingInset}px" style:padding-right="{trailingInset}px">
  <span class="side"></span>

  <ol class="strip" class:hidden={blank} bind:this={strip} aria-label="Açık sekmeler">
    {#each tabs as tab (tab.id)}
      {@const active = tab.id === activeTabId}
      <li class="chip" class:active>
        {#if active}
          <button class="address" title="Ara veya adres yaz (⌘L)" aria-current="page" onclick={() => send({ type: 'open-address' })}>
            {@render favicon(tab)}
            <span class="label">{siteLabel(tab)}</span>
          </button>
          <button class="icon small" title="Yenile" onclick={() => send({ type: 'reload' })}>
            <Icon name="reload" size={14} />
          </button>
        {:else}
          <button
            class="select"
            title={tab.title}
            onclick={() => send({ type: 'activate-tab', id: tab.id })}
            onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
          >
            {@render favicon(tab)}
            <span class="label">{siteLabel(tab)}</span>
          </button>
        {/if}
        <button class="icon small close" title="Kapat" onclick={() => send({ type: 'close-tab', id: tab.id })}>
          <Icon name="close" size={12} />
        </button>
        {#if tab.loading}<span class="loading" aria-label="Yükleniyor"></span>{/if}
      </li>
    {/each}
  </ol>

  <span class="side end">
    <span class="capsule">
      <button class="icon" title="Yeni sekme (⌘T)" onclick={() => send({ type: 'new-tab' })}>
        <Icon name="plus" />
      </button>
      <button class="icon" title="Ayarlar (⌘,)" aria-label="Ayarlar" onclick={() => send({ type: 'open-settings' })}>
        <Icon name="settings" />
      </button>
    </span>
  </span>
</header>

<style>
  .toolbar {
    display: flex;
    grid-area: bar;
    align-items: center;
    gap: 8px;
    min-width: 0;
    transition: padding-left 0.2s ease;
    -webkit-app-region: drag;
  }

  /* Equal sides keep the tabs centered over the page card. */
  .side {
    display: flex;
    flex: 1 1 0;
    min-width: max-content;
  }

  .side.end {
    justify-content: flex-end;
  }

  .capsule {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    -webkit-app-region: no-drag;
  }

  :global([data-material='glass']) .capsule,
  :global([data-material='glass']) .chip.active {
    box-shadow: var(--shadow), var(--rim);
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    transition: background var(--transition);
    -webkit-app-region: no-drag;
  }

  .icon:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .icon:disabled {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .icon.small {
    width: 22px;
    height: 22px;
    color: var(--text-muted);
  }

  .icon.small:hover {
    color: var(--text);
  }

  .strip {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 2px;
    min-width: 0;
    margin: 0;
    padding: 2px;
    overflow-x: auto;
    list-style: none;
    scrollbar-width: none;
  }

  .strip.hidden {
    visibility: hidden;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .chip {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    max-width: 150px;
    height: 32px;
    padding-right: 5px;
    border-radius: 999px;
    transition: background var(--transition);
    -webkit-app-region: no-drag;
  }

  .chip:hover {
    background: var(--surface-hover);
  }

  /* The active tab is the address field: wider, raised, site name centered. */
  .chip.active {
    width: clamp(220px, 32vw, 420px);
    max-width: none;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .chip:not(.active) .close {
    display: none;
  }

  .chip:not(.active):hover .close,
  .chip .close:focus-visible {
    display: grid;
  }

  .select,
  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 7px;
    min-width: 0;
    height: 100%;
    padding: 0 6px 0 11px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
  }

  .address {
    justify-content: center;
    padding-left: 28px;
    color: var(--text);
    font-weight: 500;
  }

  .favicon {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    color: var(--text-muted);
  }

  .chip:not(.active) .favicon {
    opacity: 0.7;
  }

  .favicon img {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading {
    position: absolute;
    right: 16px;
    bottom: 1px;
    left: 16px;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
    animation: pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 0.2;
    }
    to {
      opacity: 0.7;
    }
  }
</style>
