<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    as = 'div',
    ariaLabel,
    layout = 'toolbar',
    tone = 'surface',
    spread = false,
  }: {
    children: Snippet;
    as?: 'div' | 'nav';
    ariaLabel?: string;
    layout?: 'toolbar' | 'tab';
    tone?: 'surface' | 'active' | 'bare';
    spread?: boolean;
  } = $props();
</script>

<svelte:element
  this={as}
  class="capsule"
  class:toolbar={layout === 'toolbar'}
  class:tab={layout === 'tab'}
  class:spread
  class:surface={tone === 'surface'}
  class:active={tone === 'active'}
  class:bare={tone === 'bare'}
  aria-label={ariaLabel}
>
  {@render children()}
</svelte:element>

<style>
  .capsule {
    display: flex;
    align-items: center;
    height: var(--chrome-control-size);
    border-radius: 999px;
    color: var(--text);
    -webkit-app-region: no-drag;
  }

  .capsule.toolbar {
    flex: none;
    justify-content: center;
    gap: 2px;
    padding: 3px;
  }

  .capsule.spread {
    justify-content: space-between;
  }

  .capsule.tab {
    width: 100%;
    transition: background var(--transition);
  }

  .capsule.surface {
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .capsule.active {
    background: var(--surface-active);
    box-shadow: var(--shadow);
  }

  .capsule.bare:hover {
    background: var(--well-hover);
  }

  :global([data-material='glass']) .capsule.surface,
  :global([data-material='glass']) .capsule.active {
    box-shadow: var(--shadow), var(--rim);
  }
</style>
