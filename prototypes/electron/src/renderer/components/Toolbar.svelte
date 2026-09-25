<script lang="ts">
  import { NEW_TAB_URL, type TabSnapshot } from '../../shared/types';
  import Icon from './Icon.svelte';

  let {
    tab,
    placeholder,
    collapsed,
    onSearch,
  }: {
    tab: TabSnapshot | null;
    placeholder: string;
    collapsed: boolean;
    /** Opens the address field from the collapsed panel. */
    onSearch: () => void;
  } = $props();

  let input: HTMLInputElement | undefined = $state();
  let editing = $state(false);
  let value = $state('');

  const displayUrl = $derived(
    !tab || tab.url === 'about:blank' || tab.url === NEW_TAB_URL ? '' : tab.url,
  );

  $effect(() => {
    if (!editing) value = displayUrl;
  });

  export function focusAddress(): void {
    input?.focus();
    input?.select();
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (value.trim() === '') return;
    window.yalqen.send({ type: 'navigate', input: value });
    editing = false;
    input?.blur();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      value = displayUrl;
      editing = false;
      input?.blur();
    }
  }
</script>

<header class="toolbar" class:collapsed>
  {#if collapsed}
    <button class="icon" title="Ara veya adres yaz (⌘L)" onclick={onSearch}>
      <Icon name="search" />
    </button>
  {:else}
    <nav class="controls">
      <span class="nav">
        <button
          class="icon"
          title="Geri"
          disabled={!tab?.canGoBack}
          onclick={() => window.yalqen.send({ type: 'go-back' })}
        >
          <Icon name="back" />
        </button>
        <button
          class="icon"
          title="İleri"
          disabled={!tab?.canGoForward}
          onclick={() => window.yalqen.send({ type: 'go-forward' })}
        >
          <Icon name="forward" />
        </button>
        <button class="icon" title="Yenile" onclick={() => window.yalqen.send({ type: 'reload' })}>
          <Icon name="reload" />
        </button>
      </span>
    </nav>

    <form class="address" onsubmit={submit}>
      <span class="address-icon"><Icon name="search" size={15} /></span>
      <input
        bind:this={input}
        bind:value
        type="text"
        spellcheck="false"
        autocomplete="off"
        {placeholder}
        aria-label="Adres"
        onfocus={() => {
          editing = true;
          input?.select();
        }}
        onblur={() => (editing = false)}
        onkeydown={onKeydown}
      />
      {#if tab?.loading}<span class="loading" aria-label="Yükleniyor"></span>{/if}
    </form>
  {/if}
</header>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 14px;
  }

  .toolbar.collapsed {
    align-items: center;
    padding-top: 8px;
    -webkit-app-region: drag;
  }

  .controls {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 2px;
    height: 48px;
    -webkit-app-region: drag;
  }

  .nav {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted);
    transition: background var(--transition);
    -webkit-app-region: no-drag;
  }

  .collapsed .icon {
    width: 36px;
    height: 32px;
    border-radius: var(--radius);
  }

  .icon:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text);
  }

  .icon:disabled {
    opacity: 0.35;
  }

  .address {
    position: relative;
    min-width: 0;
  }

  .address-icon {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 12px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    pointer-events: none;
    transform: translateY(-50%);
  }

  input {
    width: 100%;
    height: 36px;
    padding: 0 12px 0 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    font: inherit;
    user-select: text;
  }

  input::placeholder {
    color: var(--text-muted);
  }

  input:focus {
    outline: 2px solid var(--focus);
    outline-offset: -1px;
  }

  .loading {
    position: absolute;
    right: 10px;
    bottom: 0;
    left: 10px;
    height: 2px;
    border-radius: 2px;
    background: var(--accent);
    opacity: 0.6;
  }

  /* Liquid Glass: controls float as capsules with a light rim over the material. */
  :global([data-material='glass']) .nav {
    padding: 3px;
    border-radius: 16px;
    background: var(--platter);
    box-shadow: var(--rim);
  }

  :global([data-material='glass']) .nav .icon {
    border-radius: 50%;
  }

  :global([data-material='glass']) input {
    border-radius: 12px;
    box-shadow: var(--shadow), var(--rim);
  }

  :global([data-material='glass']) .loading {
    right: 12px;
    left: 12px;
  }
</style>
