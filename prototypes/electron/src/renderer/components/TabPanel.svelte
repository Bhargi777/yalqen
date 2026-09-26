<script lang="ts">
  import type { PanelSide, TabId, TabSnapshot } from '../../shared/types';
  import Icon from './Icon.svelte';

  let {
    tabs,
    activeTabId,
    collapsed,
    side,
    width = $bindable(),
    minWidth,
    maxWidth,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    collapsed: boolean;
    /** Window edge the panel sits on; the resize handle and toggle icons follow it. */
    side: PanelSide;
    width: number;
    minWidth: number;
    maxWidth: number;
  } = $props();

  let dragId: TabId | null = $state(null);
  let dropIndex: number | null = $state(null);
  let brokenIcons: Record<string, true> = $state({});

  const send = window.yalqen.send;

  // Tabs kept alive are shown as favorites above the list.
  const favorites = $derived(tabs.filter((tab) => tab.keepAlive));
  const listed = $derived(tabs.filter((tab) => !tab.keepAlive));

  function label(tab: TabSnapshot): string {
    const states = [
      tab.id === activeTabId ? 'aktif' : null,
      tab.live ? null : 'bellekten çıkarılmış',
      tab.frozen ? 'dondurulmuş' : null,
      tab.keepAlive ? 'canlı tutuluyor' : null,
    ].filter(Boolean);
    return states.length > 0 ? `${tab.title} (${states.join(', ')})` : tab.title;
  }

  function onDragOver(event: DragEvent, index: number): void {
    if (!dragId) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dropIndex = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    if (dragId && dropIndex !== null) {
      // Drop positions count listed tabs only; the main process orders all tabs.
      const from = tabs.findIndex((tab) => tab.id === dragId);
      const before = listed[dropIndex];
      const target = before ? tabs.indexOf(before) : tabs.indexOf(listed[listed.length - 1]) + 1;
      const toIndex = target > from ? target - 1 : target;
      if (toIndex !== from) send({ type: 'move-tab', id: dragId, toIndex });
    }
    dragId = null;
    dropIndex = null;
  }

  function startResize(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (e: PointerEvent) => {
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      width = Math.round(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)));
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
  }
</script>

{#snippet favicon(tab: TabSnapshot, size: number)}
  <span class="favicon" style:width="{size}px" style:height="{size}px">
    {#if tab.faviconUrl && !brokenIcons[tab.faviconUrl]}
      <img
        src={tab.faviconUrl}
        alt=""
        width={size}
        height={size}
        onerror={() => (brokenIcons[tab.faviconUrl!] = true)}
      />
    {:else}
      <Icon name="globe" size={size} />
    {/if}
  </span>
{/snippet}

<aside class="panel" class:collapsed class:right={side === 'right'} aria-label="Sekmeler">
  {#if !collapsed}
    <div
      class="resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Panel genişliği"
      onpointerdown={startResize}
    ></div>
  {/if}

  <div class="top"></div>

  {#if favorites.length > 0}
    <ul class="favorites" aria-label="Favoriler">
      {#each favorites as tab (tab.id)}
        <li class="favorite" class:active={tab.id === activeTabId} class:discarded={!tab.live}>
          <button
            class="tile"
            title={label(tab)}
            aria-label={label(tab)}
            aria-current={tab.id === activeTabId ? 'page' : undefined}
            onclick={() => send({ type: 'activate-tab', id: tab.id })}
            onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
          >
            {@render favicon(tab, 16)}
          </button>
          {#if !collapsed}
            <button
              class="unpin"
              title="Favorilerden çıkar"
              onclick={() => send({ type: 'toggle-keep-alive', id: tab.id })}
            >
              <Icon name="close" size={10} />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if listed.length > 0}
    <ol class="tabs" ondrop={onDrop} ondragover={(e) => dragId && e.preventDefault()}>
      {#each listed as tab, index (tab.id)}
        <li
          class="tab"
          class:active={tab.id === activeTabId}
          class:discarded={!tab.live}
          class:drop-before={dropIndex === index}
          class:drop-after={dropIndex === index + 1 && index === listed.length - 1}
          draggable="true"
          ondragstart={() => (dragId = tab.id)}
          ondragend={() => ((dragId = null), (dropIndex = null))}
          ondragover={(e) => onDragOver(e, index)}
        >
          <button
            class="select"
            title={collapsed ? label(tab) : tab.url}
            aria-label={label(tab)}
            aria-current={tab.id === activeTabId ? 'page' : undefined}
            onclick={() => send({ type: 'activate-tab', id: tab.id })}
            onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
          >
            {@render favicon(tab, 16)}
            {#if !collapsed}
              <span class="title">{tab.title}</span>
            {/if}
          </button>

          {#if !collapsed}
            <span class="actions">
              <button
                class="action extra"
                title="Favorilere ekle (canlı tut)"
                onclick={() => send({ type: 'toggle-keep-alive', id: tab.id })}
              >
                <Icon name="pin" size={13} />
              </button>
              {#if tab.live && tab.id !== activeTabId}
                <button
                  class="action extra"
                  title="Bellekten çıkar"
                  onclick={() => send({ type: 'discard-tab', id: tab.id })}
                >
                  <Icon name="moon" size={13} />
                </button>
              {/if}
              <button
                class="action"
                title="Kapat"
                onclick={() => send({ type: 'close-tab', id: tab.id })}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  <button class="new-tab" title="Yeni sekme (⌘T)" onclick={() => send({ type: 'new-tab' })}>
    <Icon name="plus" size={14} />
    {#if !collapsed}<span>Yeni sekme</span>{/if}
  </button>

  {#if !collapsed}
    <footer class="footer">
      <span class="tab-count">{tabs.length} sekme</span>
    </footer>
  {/if}
</aside>

<style>
  .panel {
    position: relative;
    display: flex;
    grid-area: panel;
    flex-direction: column;
    min-height: 0;
    /* Same gap on both sides: the window edge on the left, the page card on the right. */
    padding: 0 8px 8px;
    background: var(--panel-tint);
    box-shadow: inset -1px 0 var(--chrome-divider);
  }

  .panel.right {
    box-shadow: inset 1px 0 var(--chrome-divider);
  }

  .panel.collapsed {
    align-items: center;
    padding: 0 0 8px;
  }

  .resize {
    position: absolute;
    top: 0;
    right: -2px;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
  }

  .panel.right .resize {
    right: auto;
    left: -2px;
  }

  .top {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    height: 44px;
    transition: padding-left 0.2s ease;
    -webkit-app-region: drag;
  }

  /* Favorites: a row of small tiles, a single column when collapsed. */
  .favorites {
    display: grid;
    flex: none;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 4px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .collapsed .favorites {
    grid-template-columns: 32px;
    gap: 2px;
    padding: 3px;
    border-radius: 14px;
    background: var(--well);
    box-shadow: var(--well-rim);
  }

  .favorite {
    position: relative;
  }

  .tile {
    display: grid;
    place-items: center;
    width: 100%;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: var(--well);
    transition: background var(--transition);
  }

  .collapsed .tile {
    height: 34px;
    border-radius: 11px;
    background: transparent;
  }

  .tile:hover {
    background: var(--well-hover);
  }

  .favorite.active .tile {
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .unpin {
    position: absolute;
    top: -3px;
    right: -3px;
    display: none;
    place-items: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text-muted);
  }

  .favorite:hover .unpin {
    display: grid;
  }

  /* Tab list: a rounded well with the active tab raised. */
  .tabs {
    flex: 0 1 auto;
    min-height: 0;
    margin: 0;
    padding: 3px;
    overflow-y: auto;
    border-radius: 14px;
    background: var(--well);
    box-shadow: var(--well-rim);
    list-style: none;
  }

  .collapsed .tabs {
    width: 38px;
  }

  /* Collapsed, favorites and tabs share one well, split by a line. */
  .collapsed .favorites:has(+ .tabs) {
    margin-bottom: 0;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }

  .collapsed .favorites + .tabs {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  .collapsed .favorites + .tabs::before {
    content: '';
    display: block;
    height: 1px;
    margin: 0 6px 3px;
    background: var(--border);
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    height: 30px;
    border-radius: 11px;
    transition: background var(--transition);
  }

  .collapsed .tab {
    height: 34px;
  }

  .tab + .tab {
    margin-top: 1px;
  }

  .tab:hover {
    background: var(--well-hover);
  }

  .tab.active {
    background: var(--surface-active);
    box-shadow: var(--shadow);
  }

  :global([data-material='glass']) .tab.active,
  :global([data-material='glass']) .favorite.active .tile {
    box-shadow: var(--shadow), var(--rim);
  }

  .tab.drop-before::before,
  .tab.drop-after::after {
    content: '';
    position: absolute;
    right: 6px;
    left: 6px;
    height: 2px;
    border-radius: 1px;
    background: var(--accent);
  }

  .tab.drop-before::before {
    top: -2px;
  }

  .tab.drop-after::after {
    bottom: -2px;
  }

  .select {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 100%;
    padding: 0 8px 0 10px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    text-align: left;
  }

  .tab.active .select {
    color: var(--text);
  }

  .collapsed .select {
    justify-content: center;
    padding: 0;
  }

  .favicon {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    color: var(--text-muted);
  }

  .tab:not(.active) .favicon {
    opacity: 0.7;
  }

  .favicon img {
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }

  .discarded .favicon img,
  .discarded .favicon > :global(svg) {
    opacity: 0.45;
    filter: grayscale(1);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Actions only show on hover, except close on the active tab. */
  .actions {
    display: flex;
    padding-right: 4px;
  }

  .tab:not(:hover, :focus-within) .extra,
  .tab:not(.active, :hover, :focus-within) .actions {
    display: none;
  }

  .action {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
  }

  .action:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .new-tab {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 30px;
    margin-top: 6px;
    padding: 0 11px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
  }

  .collapsed .new-tab {
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 50%;
  }

  .new-tab:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: auto;
    padding: 0 11px;
  }

  .tab-count {
    color: var(--text-muted);
    font-size: var(--font-size-small);
    white-space: nowrap;
  }
</style>
