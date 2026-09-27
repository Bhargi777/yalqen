<script lang="ts">
  import type { PanelSide, TabId, TabSnapshot } from '../../shared/types';
  import CircleButton from './CircleButton.svelte';
  import Icon from './Icon.svelte';
  import NewTabButton from './NewTabButton.svelte';

  let {
    tabs,
    activeTabId,
    collapsed,
    side,
    width = $bindable(),
    minWidth,
    maxWidth,
    topInset,
  }: {
    tabs: TabSnapshot[];
    activeTabId: TabId | null;
    collapsed: boolean;
    side: PanelSide;
    width: number;
    minWidth: number;
    maxWidth: number;
    topInset: number;
  } = $props();

  let dragId: TabId | null = $state(null);
  let dropIndex: number | null = $state(null);
  let brokenIcons: Record<string, true> = $state({});

  const send = window.yalqen.send;

  const pinned = $derived(tabs.filter((tab) => tab.pinned));
  const listed = $derived(tabs.filter((tab) => !tab.pinned));

  function label(tab: TabSnapshot): string {
    const states = [
      tab.id === activeTabId ? 'aktif' : null,
      tab.isPrivate ? 'gizli' : null,
      tab.live ? null : 'bellekten çıkarılmış',
      tab.frozen ? 'dondurulmuş' : null,
      tab.pinned ? 'sabitlendi' : null,
      tab.muted ? 'sessiz' : tab.audible ? 'ses çalıyor' : null,
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

  <div class="top" style:height="{topInset}px"></div>

  {#if pinned.length > 0}
    <ul class="favorites" aria-label="Sabitlenenler">
      {#each pinned as tab (tab.id)}
        <li class="favorite" class:active={tab.id === activeTabId} class:discarded={!tab.live}>
          {#if collapsed}
            <CircleButton
              title={label(tab)}
              ariaLabel={label(tab)}
              ariaCurrent={tab.id === activeTabId ? 'page' : undefined}
              onclick={() => send({ type: 'activate-tab', id: tab.id })}
              onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
            >
              {@render favicon(tab, 16)}
            </CircleButton>
          {:else}
            <button
              class="tile"
              title={label(tab)}
              aria-label={label(tab)}
              aria-current={tab.id === activeTabId ? 'page' : undefined}
              onclick={() => send({ type: 'activate-tab', id: tab.id })}
              onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
            >
              {@render favicon(tab, 20)}
            </button>
            <button
              class="unpin"
              title="Sabitlemeyi kaldır"
              aria-label="Sabitlemeyi kaldır: {tab.title}"
              onclick={() => send({ type: 'toggle-pin', id: tab.id })}
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
          class:private={tab.isPrivate}
          class:active={tab.id === activeTabId}
          class:discarded={!tab.live}
          class:drop-before={dropIndex === index}
          class:drop-after={dropIndex === index + 1 && index === listed.length - 1}
          draggable="true"
          ondragstart={() => (dragId = tab.id)}
          ondragend={() => ((dragId = null), (dropIndex = null))}
          ondragover={(e) => onDragOver(e, index)}
        >
          {#if collapsed}
            <CircleButton
              title={label(tab)}
              ariaLabel={label(tab)}
              ariaCurrent={tab.id === activeTabId ? 'page' : undefined}
              onclick={() => send({ type: 'activate-tab', id: tab.id })}
              onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
            >
              {@render favicon(tab, 16)}
            </CircleButton>
          {:else}
            <button
              class="select"
              title={tab.url}
              aria-label={label(tab)}
              aria-current={tab.id === activeTabId ? 'page' : undefined}
              onclick={() => send({ type: 'activate-tab', id: tab.id })}
              onauxclick={(e) => e.button === 1 && send({ type: 'close-tab', id: tab.id })}
            >
              {@render favicon(tab, 16)}
              <span class="title">{tab.title}</span>
              {#if tab.isPrivate}<span class="private-mark" title="Gizli sekme"><Icon name="private" size={13} /></span>{/if}
            </button>

            {#if tab.audible || tab.muted}
              <button
                class="action audio"
                title={tab.muted ? 'Sesi aç' : 'Sessize al'}
                aria-label={tab.muted ? 'Sesi aç' : 'Sessize al'}
                aria-pressed={tab.muted}
                onclick={() => send({ type: 'toggle-mute', id: tab.id })}
              >
                <Icon name={tab.muted ? 'muted' : 'sound'} size={13} />
              </button>
            {/if}
            <span class="actions">
              {#if !tab.isPrivate && /^https?:/.test(tab.url)}
                <button
                  class="action extra"
                  title="Sabitle"
                  onclick={() => send({ type: 'toggle-pin', id: tab.id })}
                >
                  <Icon name="pin" size={13} />
                </button>
              {/if}
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

  <div class="new-tab-position">
    <NewTabButton compact={collapsed} />
  </div>

  <footer class="footer" class:compact={collapsed}>
    {#if !collapsed}
      <span class="tab-count">{tabs.length} sekme</span>
    {/if}
    <button
      class="panel-toggle"
      title={collapsed ? 'Yan paneli genişlet (⌘S)' : 'Yan paneli daralt (⌘S)'}
      aria-label={collapsed ? 'Yan paneli genişlet' : 'Yan paneli daralt'}
      aria-expanded={!collapsed}
      onclick={() => send({ type: 'toggle-panel' })}
    >
      <Icon name={side === 'left' ? (collapsed ? 'panel-expand' : 'panel-close') : (collapsed ? 'panel-expand-right' : 'panel-close-right')} size={16} />
    </button>
  </footer>
</aside>

<style>
  .panel {
    position: relative;
    display: flex;
    grid-area: panel;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: 0 8px 8px;
    overflow-x: clip;
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

  .favorites {
    display: grid;
    flex: none;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 6px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
  }

  .collapsed .favorites {
    grid-template-columns: var(--chrome-control-size);
    gap: 6px;
  }

  .favorite {
    position: relative;
  }

  .tile {
    display: grid;
    place-items: center;
    width: 100%;
    height: 46px;
    padding: 0;
    border: 0;
    border-radius: 14px;
    background: var(--well);
    box-shadow: var(--well-rim);
    transition: background var(--transition), box-shadow var(--transition);
  }

  :global([data-material='glass']) .panel:not(.collapsed) .tile {
    background: var(--platter);
    box-shadow: var(--rim);
  }

  .tile:hover,
  :global([data-material='glass']) .panel:not(.collapsed) .tile:hover {
    background: var(--well-hover);
  }

  .favorite.active .tile,
  :global([data-material='glass']) .panel:not(.collapsed) .favorite.active .tile {
    background: var(--surface-active);
    box-shadow: var(--shadow);
  }

  :global([data-material='glass']) .panel:not(.collapsed) .favorite.active .tile {
    box-shadow: var(--shadow), var(--rim);
  }

  .unpin {
    position: absolute;
    top: -4px;
    right: -4px;
    display: none;
    place-items: center;
    width: 16px;
    height: 16px;
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

  .tabs {
    flex: 0 1 auto;
    min-height: 0;
    margin: 0;
    padding: 2px;
    overflow-y: auto;
    border-radius: 18px;
    background: var(--well);
    box-shadow: var(--well-rim);
    list-style: none;
  }

  .collapsed .tabs {
    width: calc(var(--chrome-control-size) + 8px);
    padding: 4px;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    scrollbar-width: none;
  }

  .collapsed .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    height: calc(var(--chrome-control-size) - 4px);
    border-radius: 999px;
    transition: background var(--transition);
  }

  .collapsed .tab {
    height: var(--chrome-control-size);
  }

  .tab + .tab {
    margin-top: 1px;
  }

  .collapsed .tab + .tab {
    margin-top: 6px;
  }

  .panel:not(.collapsed) .tab:hover {
    background: var(--well-hover);
  }

  .panel:not(.collapsed) .tab.active {
    background: var(--surface-active);
    box-shadow: var(--shadow);
  }

  :global([data-material='glass']) .panel:not(.collapsed) .tab.active,
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
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    text-align: left;
  }

  .tab.active .select {
    color: var(--text);
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

  .tab.discarded .favicon img,
  .tab.discarded .favicon > :global(svg) {
    opacity: 0.45;
    filter: grayscale(1);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  .private-mark {
    display: grid;
    flex: none;
    place-items: center;
    margin-left: auto;
    color: var(--text-muted);
  }

  .tab.private .title {
    font-style: italic;
  }

  .audio {
    flex: none;
  }

  .tab:not(.active, :hover, :focus-within) .audio {
    margin-right: 4px;
  }

  .new-tab-position {
    flex: none;
    margin-top: 6px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--chrome-control-size);
    margin-top: auto;
    padding: 0 8px;
  }

  .footer.compact {
    justify-content: center;
    padding: 0;
  }

  .panel-toggle {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--chrome-control-size);
    height: var(--chrome-control-size);
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    -webkit-app-region: no-drag;
  }

  .panel-toggle:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .panel-toggle:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .tab-count {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-muted);
    font-size: var(--font-size-small);
    white-space: nowrap;
  }
</style>
