<script lang="ts">
  import type { DownloadsSummary, TabId, TabSnapshot } from '../../shared/types';
  import { isNewTab, siteLabel } from '../format';
  import Icon from './Icon.svelte';

  let {
    tabs,
    activeTabId,
    zoom,
    defaultZoom,
    downloads,
    leadingInset,
    trailingInset,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    zoom: number;
    defaultZoom: number;
    downloads: DownloadsSummary;
    leadingInset: number;
    trailingInset: number;
  } = $props();

  let brokenIcons: Record<string, true> = $state({});
  let strip: HTMLElement | undefined = $state();
  const send = window.yalqen.send;
  const activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) ?? null);

  $effect(() => {
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


<header class="toolbar" style:padding-left="{leadingInset}px" style:padding-right="{trailingInset}px">
  <div class="side leading" aria-hidden="true"></div>

  <div class="tab-group" style:transform="translateX({(trailingInset - leadingInset) / 2}px)">
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
            class:dangerous={tab.security === 'dangerous'}
            title="Site bilgisi"
            aria-label={tab.security === 'secure' ? 'Bağlantı güvenli, site bilgisi' : 'Güvenli değil, site bilgisi'}
            onclick={() => send({ type: 'open-site-info' })}
          >
            <Icon name={tab.security === 'secure' ? 'lock' : tab.security === 'dangerous' ? 'warning' : 'info'} size={13} />
            {#if tab.security === 'insecure' || tab.security === 'dangerous'}<span>Güvenli değil</span>{/if}
          </button>
        {/if}
        {#if active}
          {#if tab.isPrivate}
            <span class="private-badge" title="Gizli sekme: geçmiş kaydedilmez, çerezler sekmeler kapanınca silinir">
              <Icon name="private" size={14} />
            </span>
          {/if}
          <button class="address" class:after-site={tab.security !== 'local' || tab.isPrivate} title="Ara veya adres yaz (⌘L)" aria-current="page" onclick={() => send({ type: 'open-address' })}>
            {@render favicon(tab)}
            <span class="label">{siteLabel(tab)}</span>
          </button>
          {#if tab.url.startsWith('http') || tab.url.startsWith('file:')}
            <button
              class="star"
              class:on={tab.bookmarked}
              title={tab.bookmarked ? 'Yer iminden kaldır (⌘D)' : 'Yer imlerine ekle (⌘D)'}
              aria-label={tab.bookmarked ? 'Yer iminden kaldır' : 'Yer imlerine ekle'}
              aria-pressed={tab.bookmarked}
              onclick={() => send({ type: 'toggle-bookmark' })}
            >
              <Icon name="star" size={13} />
            </button>
          {/if}
          {#if tab.blockedPopups > 0}
            <button
              class="popups"
              title="Açılır pencere engellendi"
              aria-label="{tab.blockedPopups} açılır pencere engellendi"
              onclick={() => send({ type: 'open-blocked-popups' })}
            >
              <Icon name="popup-blocked" size={13} />
            </button>
          {/if}
          {#if Math.round(zoom * 100) !== Math.round(defaultZoom * 100)}
            <button class="zoom" title="Varsayılan yakınlaştırmaya dön (⌘0)" onclick={() => send({ type: 'reset-zoom' })}>
              %{Math.round(zoom * 100)}
            </button>
          {/if}
        {:else}
          <button
            class="select"
            class:private={tab.isPrivate}
            title={tab.isPrivate ? `${tab.title} (gizli)` : tab.title}
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
    <div class="new-tab-slot">
      <div class="capsule">
        <button class="icon" title="Yeni sekme (⌘T)" aria-label="Yeni sekme" onclick={() => send({ type: 'new-tab' })}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  </div>

  <div class="side trailing">
    <div class="capsule">
      <button class="icon" title="Yer imleri" aria-label="Yer imleri" onclick={() => send({ type: 'open-bookmarks-menu' })}>
        <Icon name="bookmarks" />
      </button>
      <button class="icon" title="Geçmiş (⌘Y)" aria-label="Geçmiş" onclick={() => send({ type: 'open-history' })}>
        <Icon name="history" />
      </button>
      <button class="icon" title="Profil" aria-label="Profil" onclick={() => send({ type: 'open-profile-menu' })}>
        <Icon name="profile" />
      </button>
      <button class="icon" title="Ayarlar (⌘,)" aria-label="Ayarlar" onclick={() => send({ type: 'open-settings' })}>
        <Icon name="settings" />
      </button>
      <button
        class="icon downloads"
        class:active={downloads.active > 0}
        title="İndirilenler"
        aria-label={downloads.active > 0 ? `İndirilenler, ${downloads.active} indirme sürüyor` : 'İndirilenler'}
        onclick={() => send({ type: 'open-downloads' })}
      >
        <Icon name="download" />
        {#if downloads.active > 0}
          <svg class="ring" class:indeterminate={downloads.progress === null} viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="12.5" pathLength="100" stroke-dasharray="{downloads.progress === null ? 25 : Math.max(2, downloads.progress * 100)} 100" />
          </svg>
        {/if}
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

  .new-tab-slot {
    display: flex;
    flex: none;
    width: 92px;
  }

  @media (max-width: 760px) {
    .new-tab-slot {
      width: 34px;
    }
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
    padding-left: 33px;
    color: var(--text);
    font-weight: 500;
  }

  .address:not(.after-site)::after {
    flex: none;
    width: 16px;
    content: '';
  }

  .private-badge {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-left: 4px;
    border-radius: 50%;
    background: var(--text);
    color: var(--surface);
  }

  .select.private {
    font-style: italic;
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

  .site.dangerous {
    color: #d93025;
    font-weight: 600;
  }

  .address.after-site {
    padding-left: 6px;
  }

  .downloads {
    position: relative;
  }

  .downloads.active {
    color: var(--accent);
  }

  .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .ring circle {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.6;
    stroke-linecap: round;
    transition: stroke-dasharray 0.25s linear;
  }

  .ring.indeterminate {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring.indeterminate {
      animation: none;
    }
  }

  .star {
    display: grid;
    flex: none;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
  }

  .star:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .star.on {
    color: var(--accent);
  }

  .star.on :global(path) {
    fill: currentColor;
  }

  .popups {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--warn);
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
