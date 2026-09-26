<script lang="ts">
  import type { TabId, TabSnapshot } from '../../shared/types';
  import { isNewTab, siteLabel } from '../format';
  import Icon from './Icon.svelte';

  let {
    tabs,
    activeTabId,
    zoom,
    leadingInset,
    trailingInset,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    /** Zoom factor of the active page. */
    zoom: number;
    /** Space kept for macOS window controls when the sidebar is narrow. */
    leadingInset: number;
    /** Gap between settings and the window edge or sidebar. */
    trailingInset: number;
  } = $props();

  let brokenIcons: Record<string, true> = $state({});
  let strip: HTMLElement | undefined = $state();
  const send = window.yalqen.send;
  const activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) ?? null);

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

<!-- The active tab doubles as the address field; the existing capsules now frame the tab strip. -->
<header class="toolbar" style:padding-left="{leadingInset}px" style:padding-right="{trailingInset}px">
  <div class="side leading" aria-hidden="true"></div>

  <div class="tab-group">
    <nav class="capsule navigation" aria-label="Gezinme">
      <button class="icon" title="Geri" disabled={!activeTab?.canGoBack} onclick={() => send({ type: 'go-back' })}>
        <Icon name="back" />
      </button>
      <button class="icon" title="İleri" disabled={!activeTab?.canGoForward} onclick={() => send({ type: 'go-forward' })}>
        <Icon name="forward" />
      </button>
      {#if activeTab?.loading}
        <button class="icon" title="Durdur (Esc)" aria-label="Durdur" onclick={() => send({ type: 'stop' })}>
          <Icon name="close" />
        </button>
      {:else}
        <button class="icon" title="Yenile (⌘R)" aria-label="Yenile" onclick={() => send({ type: 'reload' })}>
          <Icon name="reload" />
        </button>
      {/if}
    </nav>
    <ol class="strip" bind:this={strip} aria-label="Açık sekmeler">
    {#each tabs as tab (tab.id)}
      {@const active = tab.id === activeTabId}
      <li class="chip" class:active>
        {#if active && tab.security !== 'local'}
          <button
            class="site"
            class:insecure={tab.security === 'insecure'}
            title="Site bilgisi"
            aria-label={tab.security === 'secure' ? 'Bağlantı güvenli, site bilgisi' : 'Güvenli değil, site bilgisi'}
            onclick={() => send({ type: 'open-site-info' })}
          >
            <Icon name={tab.security === 'secure' ? 'lock' : 'info'} size={13} />
            {#if tab.security === 'insecure'}<span>Güvenli değil</span>{/if}
          </button>
        {/if}
        {#if active}
          <button class="address" class:after-site={tab.security !== 'local'} title="Ara veya adres yaz (⌘L)" aria-current="page" onclick={() => send({ type: 'open-address' })}>
            {@render favicon(tab)}
            <span class="label">{siteLabel(tab)}</span>
          </button>
          {#if Math.round(zoom * 100) !== 100}
            <button class="zoom" title="Gerçek boyuta dön (⌘0)" onclick={() => send({ type: 'reset-zoom' })}>
              %{Math.round(zoom * 100)}
            </button>
          {/if}
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
        {#if tab.audible || tab.muted}
          <button
            class="icon small"
            title={tab.muted ? 'Sesi aç' : 'Sessize al'}
            aria-label={tab.muted ? 'Sesi aç' : 'Sessize al'}
            aria-pressed={tab.muted}
            onclick={() => send({ type: 'toggle-mute', id: tab.id })}
          >
            <Icon name={tab.muted ? 'muted' : 'sound'} size={12} />
          </button>
        {/if}
        <button class="icon small close" title="Kapat" onclick={() => send({ type: 'close-tab', id: tab.id })}>
          <Icon name="close" size={12} />
        </button>
        {#if tab.loading}<span class="loading" aria-label="Yükleniyor"></span>{/if}
      </li>
    {/each}
    </ol>
    <div class="capsule">
      <button class="icon" title="Yeni sekme (⌘T)" aria-label="Yeni sekme" onclick={() => send({ type: 'new-tab' })}>
        <Icon name="plus" />
      </button>
    </div>
  </div>

  <div class="side trailing">
    <div class="capsule">
      <button class="icon" title="Geçmiş (⌘Y)" aria-label="Geçmiş" onclick={() => send({ type: 'open-history' })}>
        <Icon name="history" />
      </button>
      <button class="icon" title="Profil" aria-label="Profil" onclick={() => send({ type: 'open-profile-menu' })}>
        <Icon name="profile" />
      </button>
      <button class="icon" title="Ayarlar (⌘,)" aria-label="Ayarlar" onclick={() => send({ type: 'open-settings' })}>
        <Icon name="settings" />
      </button>
      <button class="icon" title="İndirilenler klasörünü aç" aria-label="İndirilenler klasörünü aç" onclick={() => send({ type: 'open-downloads' })}>
        <Icon name="download" />
      </button>
    </div>
  </div>
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

  /* Equal sides keep the tab group centered over the page card. */
  .side {
    display: flex;
    flex: 1 1 0;
    align-items: center;
    min-width: max-content;
  }

  .leading {
    justify-content: space-between;
  }

  .trailing {
    justify-content: flex-end;
  }

  .tab-group {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .capsule {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 2px;
    border: 0;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    -webkit-app-region: no-drag;
  }

  :global([data-material='glass']) .capsule {
    box-shadow: var(--shadow), var(--rim);
  }

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
    min-width: 120px;
    flex-shrink: 1;
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

  .site {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    height: 24px;
    margin-left: 4px;
    padding: 0 6px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
    transition: background var(--transition), color var(--transition);
  }

  .site:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .site.insecure {
    color: var(--warn);
  }

  /* The site button on the left takes the place of the centering padding. */
  .address.after-site {
    padding-left: 6px;
  }

  .zoom {
    flex: none;
    height: 22px;
    padding: 0 7px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    transition: color var(--transition);
  }

  .zoom:hover {
    color: var(--text);
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

  .chip.active .loading {
    overflow: hidden;
    background: transparent;
    animation: none;
  }

  .chip.active .loading::after {
    position: absolute;
    top: 0;
    left: 0;
    width: 28%;
    height: 100%;
    border-radius: inherit;
    background: #f28c28;
    content: '';
    animation: search-sweep 1.4s ease-in-out infinite;
  }

  @keyframes search-sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(360%);
    }
  }

  @keyframes pulse {
    from {
      opacity: 0.2;
    }
    to {
      opacity: 0.7;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip.active .loading::after {
      width: 100%;
      animation: none;
    }
  }
</style>
