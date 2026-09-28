<script lang="ts">
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';

  let { compact = true }: { compact?: boolean } = $props();

  const send = window.yalqen.send;
</script>

{#if compact}
  <IconButton
    size="lg"
    variant="surface"
    icon="plus"
    label="Yeni sekme"
    title="Yeni sekme (⌘T)"
    onclick={() => send({ type: 'new-tab' })}
  />
{:else}
  <Button size="lg" icon="plus" class="new-tab-wide" title="Yeni sekme (⌘T)" onclick={() => send({ type: 'new-tab' })}>
    Yeni sekme
  </Button>
{/if}

<style>
  :global(.btn.new-tab-wide) {
    width: 100%;
    justify-content: flex-start;
    padding-left: 10px;
  }
</style>
