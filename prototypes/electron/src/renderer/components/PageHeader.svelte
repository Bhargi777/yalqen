<script lang="ts">
  import type { TabSnapshot } from '../../shared/types';
  import { isNewTab, siteLabel } from '../format';
  import Icon from './Icon.svelte';

  let { tab, height }: { tab: TabSnapshot | null; height: number } = $props();

  let brokenIcon = $state<string | null>(null);

  const send = window.yalqen.send;
</script>

<header class="header" style:height="{height}px">
  <span class="side">
    <button class="icon" title="Geri" disabled={!tab?.canGoBack} onclick={() => send({ type: 'go-back' })}>
      <Icon name="back" />
    </button>
    <button class="icon" title="İleri" disabled={!tab?.canGoForward} onclick={() => send({ type: 'go-forward' })}>
      <Icon name="forward" />
    </button>
    <button class="icon" title="Yenile" onclick={() => send({ type: 'reload' })}>
      <Icon name="reload" />
    </button>
  </span>

  <button class="address" title="Ara veya adres yaz (⌘L)" onclick={() => send({ type: 'open-address' })}>
    {#if tab && !isNewTab(tab.url)}
      <span class="favicon">
        {#if tab.faviconUrl && brokenIcon !== tab.faviconUrl}
          <img src={tab.faviconUrl} alt="" width="18" height="18" onerror={() => (brokenIcon = tab.faviconUrl)} />
        {:else}
          <Icon name="globe" />
        {/if}
      </span>
      <span class="label">{siteLabel(tab)}</span>
    {:else}
      <span class="favicon"><Icon name="search" /></span>
      <span class="label muted">Ara veya adres yaz</span>
    {/if}
  </button>

  <span class="side end">
    {#if tab}
      <button
        class="icon"
        class:on={tab.keepAlive}
        title={tab.keepAlive ? 'Favorilerden çıkar' : 'Favorilere ekle (canlı tut)'}
        aria-pressed={tab.keepAlive}
        onclick={() => send({ type: 'toggle-keep-alive', id: tab.id })}
      >
        <Icon name="sparkle" />
      </button>
      <button class="icon" title="Sekmeyi kapat (⌘W)" onclick={() => send({ type: 'close-tab', id: tab.id })}>
        <Icon name="close" />
      </button>
    {/if}
  </span>

  {#if tab?.loading}<span class="loading" aria-label="Yükleniyor"></span>{/if}
</header>

<style>
  .header {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    padding: 0 10px;
  }

  .side {
    display: flex;
    gap: 2px;
  }

  .side.end {
    justify-content: flex-end;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    transition: background var(--transition);
  }

  .icon:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text);
  }

  .icon.on {
    color: var(--accent);
  }

  .icon:disabled {
    opacity: 0.35;
  }

  .address {
    display: flex;
    align-items: center;
    gap: 9px;
    max-width: 420px;
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text);
    font-size: 15px;
    font-weight: 500;
  }

  .address:hover {
    background: var(--surface-hover);
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

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--text-muted);
    font-weight: 400;
  }

  .loading {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    background: var(--accent);
    opacity: 0.6;
    animation: pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    from {
      opacity: 0.25;
    }
  }
</style>
