<script lang="ts">
  import { onMount } from 'svelte';
  import type { FindResult } from '../shared/types';
  import Icon from './components/Icon.svelte';

  let input: HTMLInputElement | undefined = $state();
  let value = $state('');
  let result = $state<FindResult | null>(null);

  const status = $derived(
    value === '' || result === null ? '' : result.matches === 0 ? 'Sonuç yok' : `${result.active}/${result.matches}`,
  );

  function search(): void {
    result = null;
    window.yalqenFind.send({ type: 'find', text: value, forward: true, next: false });
  }

  function step(forward: boolean): void {
    if (value === '') return;
    window.yalqenFind.send({ type: 'find', text: value, forward, next: true });
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      window.yalqenFind.send({ type: 'close' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      step(!event.shiftKey);
    }
  }

  onMount(() => {
    const offOpen = window.yalqenFind.onOpen(() => {
      input?.focus();
      input?.select();
      // Highlights are cleared when the bar closes; show them again.
      if (value !== '') search();
    });
    const offResult = window.yalqenFind.onResult((next) => (result = next));
    return () => {
      offOpen();
      offResult();
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="bar" role="search">
  <input
    bind:this={input}
    bind:value
    oninput={search}
    type="text"
    spellcheck="false"
    autocomplete="off"
    placeholder="Sayfada bul"
    aria-label="Sayfada bul"
  />
  <span class="status" class:empty={result?.matches === 0} aria-live="polite">{status}</span>
  <button title="Önceki (⇧↩)" aria-label="Önceki" disabled={!result?.matches} onclick={() => step(false)}>
    <Icon name="up" size={14} />
  </button>
  <button title="Sonraki (↩)" aria-label="Sonraki" disabled={!result?.matches} onclick={() => step(true)}>
    <Icon name="down" size={14} />
  </button>
  <button title="Kapat (Esc)" aria-label="Kapat" onclick={() => window.yalqenFind.send({ type: 'close' })}>
    <Icon name="close" size={14} />
  </button>
</div>

<style>
  :global(body) {
    background: transparent;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 40px;
    margin: 4px 8px;
    padding: 0 6px 0 14px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow:
      0 0 0 0.5px rgb(0 0 0 / 0.12),
      0 6px 16px rgb(0 0 0 / 0.14);
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 14px;
    user-select: text;
  }

  input::placeholder {
    color: var(--text-muted);
  }

  input:focus {
    outline: none;
  }

  .status {
    flex: none;
    padding: 0 6px;
    color: var(--text-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .status.empty {
    color: var(--warn);
  }

  button {
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
  }

  button:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  button:disabled {
    color: var(--text-muted);
    opacity: 0.5;
  }

  @media (prefers-color-scheme: dark) {
    .bar {
      box-shadow:
        0 0 0 0.5px rgb(255 255 255 / 0.14),
        0 6px 16px rgb(0 0 0 / 0.4);
    }
  }
</style>
