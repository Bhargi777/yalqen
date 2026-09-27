<script lang="ts">
  import Icon from './Icon.svelte';
  import CircleButton from './CircleButton.svelte';

  let { compact = true }: { compact?: boolean } = $props();

  const send = window.yalqen.send;
</script>

{#if compact}
  <CircleButton title="Yeni sekme (⌘T)" ariaLabel="Yeni sekme" onclick={() => send({ type: 'new-tab' })}>
    <Icon name="plus" size={16} />
  </CircleButton>
{:else}
  <button type="button" title="Yeni sekme (⌘T)" aria-label="Yeni sekme" onclick={() => send({ type: 'new-tab' })}>
    <Icon name="plus" size={16} />
    <span>Yeni sekme</span>
  </button>
{/if}

<style>
  button {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: var(--chrome-control-size);
    padding: 0 11px;
    border: 0;
    overflow: hidden;
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    white-space: nowrap;
    transition: background var(--transition), color var(--transition);
    -webkit-app-region: no-drag;
  }

  button > :global(svg) {
    flex: none;
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

</style>
