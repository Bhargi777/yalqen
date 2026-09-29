<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExtensionInfo } from '../../shared/types';
  import Icon from './Icon.svelte';
  import Button from './ui/Button.svelte';
  import IconButton from './ui/IconButton.svelte';

  const api = window.yalqenSettings;

  let extensions = $state<ExtensionInfo[]>([]);
  let installing = $state(false);
  let installError = $state<string | null>(null);

  async function install(): Promise<void> {
    installing = true;
    installError = null;
    try {
      installError = await api.installExtension();
    } finally {
      installing = false;
    }
  }

  onMount(() => {
    void api.extensions().then((next) => (extensions = next));
    return api.onExtensionsChange((next) => (extensions = next));
  });
</script>

<h2>Uzantılar</h2>
<p class="hint intro">
  Paketlenmemiş Chrome uzantılarını klasöründen yükleyin. Uzantılar gizli sekmelerde ve geliştirici pencerelerinde
  çalışmaz. Chrome'un uzantı arayüzlerinin yalnızca bir kısmı desteklenir; bazı uzantılar beklendiği gibi
  çalışmayabilir.
</p>

{#each extensions as extension (extension.path)}
  <div class="extension" class:disabled={!extension.enabled}>
    <span class="icon">
      {#if extension.icon}
        <img src={extension.icon} alt="" width="32" height="32" />
      {:else}
        <Icon name="extensions" size={20} />
      {/if}
    </span>
    <div class="details">
      <span class="name">{extension.name} <span class="hint">{extension.version}</span></span>
      {#if extension.description}<span class="hint">{extension.description}</span>{/if}
      <span class="hint path" title={extension.path}>{extension.path}</span>
      {#if extension.error}<span class="error" role="alert">Yüklenemedi: {extension.error}</span>{/if}
    </div>
    <div class="controls">
      {#if extension.hasOptions}
        <Button size="sm" onclick={() => api.openExtensionOptions(extension.path)}>Seçenekler</Button>
      {/if}
      <input
        type="checkbox"
        checked={extension.enabled}
        aria-label="{extension.name} etkin"
        title={extension.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}
        onchange={(event) => api.setExtensionEnabled(extension.path, event.currentTarget.checked)}
      />
      <IconButton
        icon="close"
        tone="muted"
        label="{extension.name} kaldır"
        onclick={() => api.removeExtension(extension.path)}
      />
    </div>
  </div>
{:else}
  <p class="hint empty">Yüklü uzantı yok.</p>
{/each}

<div class="actions">
  <Button icon="plus" disabled={installing} onclick={install}>Klasörden yükle…</Button>
  {#if installError}<span class="error" role="alert">Yüklenemedi: {installError}</span>{/if}
</div>

<style>
  h2 {
    margin: 12px 0 4px;
    color: var(--text-muted);
    font-size: var(--font-size-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .hint {
    color: var(--text-muted);
    font-size: var(--font-size-small);
  }

  .error {
    color: var(--warn);
    font-size: var(--font-size-small);
  }

  .intro {
    margin: 0 0 8px;
  }

  .empty {
    margin: 8px 0;
  }

  .extension {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .extension.disabled .icon,
  .extension.disabled .details {
    opacity: 0.6;
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--text-muted);
  }

  .icon img {
    width: 32px;
    height: 32px;
  }

  .details {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-weight: 500;
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .controls {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
  }

  .controls input {
    margin: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0 4px;
  }
</style>
