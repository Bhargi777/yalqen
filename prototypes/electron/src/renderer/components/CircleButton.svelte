<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    title,
    ariaLabel,
    ariaCurrent,
    onclick,
    onauxclick,
  }: {
    children: Snippet;
    title: string;
    ariaLabel: string;
    ariaCurrent?: 'page';
    onclick: (event: MouseEvent) => void;
    onauxclick?: (event: MouseEvent) => void;
  } = $props();
</script>

<button
  type="button"
  {title}
  aria-label={ariaLabel}
  aria-current={ariaCurrent}
  {onclick}
  {onauxclick}
>
  <span class="content">{@render children()}</span>
</button>

<style>
  button {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: var(--chrome-control-size);
    height: var(--chrome-control-size);
    padding: 0;
    border: 0;
    overflow: hidden;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    -webkit-app-region: no-drag;
  }

  :global([data-material='glass']) button {
    box-shadow: var(--shadow), var(--rim);
  }

  button::before {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--surface-hover);
    content: '';
    opacity: 0;
    transition: opacity var(--transition);
  }

  button:hover::before {
    opacity: 1;
  }

  .content {
    position: relative;
    display: grid;
    place-items: center;
  }
</style>
