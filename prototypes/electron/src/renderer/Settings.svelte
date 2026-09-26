<script lang="ts">
  import { onMount } from 'svelte';
  import type { ClearDataRange, SettingsValues, SettingsView } from '../shared/types';

  const api = window.yalqenSettings;

  const panelOptions = [
    { value: false, label: 'Geniş' },
    { value: true, label: 'Dar' },
  ] as const;
  const sideOptions = [
    { value: 'left', label: 'Sol' },
    { value: 'right', label: 'Sağ' },
  ] as const;
  const onOffOptions = [
    { value: true, label: 'Açık' },
    { value: false, label: 'Kapalı' },
  ] as const;
  const themeOptions = [
    { value: 'system', label: 'Sistem' },
    { value: 'light', label: 'Açık' },
    { value: 'dark', label: 'Koyu' },
  ] as const;
  const startupOptions = [
    { value: 'restore', label: 'Kaldığım yerden devam et' },
    { value: 'new-tab', label: 'Yeni sekmeyle başla' },
  ] as const;

  const rangeOptions: { value: ClearDataRange; label: string }[] = [
    { value: 'hour', label: 'Son 1 saat' },
    { value: 'day', label: 'Son 24 saat' },
    { value: 'week', label: 'Son 7 gün' },
    { value: 'month', label: 'Son 4 hafta' },
    { value: 'all', label: 'Tüm zamanlar' },
  ];
  const clearOptions = [
    { key: 'history', label: 'Tarama geçmişi' },
    { key: 'downloads', label: 'İndirme listesi' },
    { key: 'siteData', label: 'Çerezler ve site verileri' },
    { key: 'cache', label: 'Önbellek' },
  ] as const;

  let clearRange = $state<ClearDataRange>('hour');
  let clearKinds = $state({ history: true, downloads: false, siteData: false, cache: false });
  let clearing = $state(false);
  let cleared = $state(false);
  const clearSelected = $derived(Object.values(clearKinds).some(Boolean));

  async function clearData(): Promise<void> {
    clearing = true;
    cleared = false;
    try {
      await api.clearData({ range: clearRange, ...clearKinds });
      cleared = true;
    } finally {
      clearing = false;
    }
  }

  let view = $state<SettingsView | null>(null);
  let templateDraft = $state('');
  let editingTemplate = $state(false);

  const values = $derived(view?.values);
  const isCustom = $derived(values?.searchEngine === 'custom');
  const templateInvalid = $derived(
    isCustom && !!values?.customSearchTemplate && !view?.customTemplateValid,
  );

  $effect(() => {
    if (!editingTemplate) templateDraft = values?.customSearchTemplate ?? '';
  });

  async function update(patch: Partial<SettingsValues>): Promise<void> {
    view = await api.update(patch);
  }

  function commitTemplate(): void {
    editingTemplate = false;
    void update({ customSearchTemplate: templateDraft.trim() || null });
  }

  onMount(() => {
    void api.get().then((next) => (view = next));
    return api.onChange((next) => (view = next));
  });
</script>

{#if view && values}
  <main class="settings">
    <h2>Arama</h2>
    <div class="row">
      <label for="engine" class="label">
        <span>Arama motoru</span>
        <span class="hint">Adres çubuğuna adres dışında bir şey yazıldığında kullanılır.</span>
      </label>
      <select
        id="engine"
        value={values.searchEngine}
        onchange={(event) =>
          update({ searchEngine: event.currentTarget.value as SettingsValues['searchEngine'] })}
      >
        {#each view.engines as engine (engine.id)}
          <option value={engine.id}>{engine.label}</option>
        {/each}
        <option value="custom">Özel</option>
      </select>
    </div>
    {#if isCustom}
      <div class="row stacked">
        <label for="engine-url" class="label">
          <span>Arama adresi</span>
          <span class="hint">Aranan metin %s yerine yazılır. Geçerli bir adres girilene kadar Google kullanılır.</span>
        </label>
        <input
          id="engine-url"
          type="url"
          spellcheck="false"
          autocomplete="off"
          placeholder="https://ornek.com/search?q=%s"
          class:invalid={templateInvalid}
          aria-invalid={templateInvalid}
          bind:value={templateDraft}
          onfocus={() => (editingTemplate = true)}
          onchange={commitTemplate}
          onblur={() => (editingTemplate = false)}
        />
        {#if templateInvalid}
          <span class="error" role="alert">Adres http(s) ile başlamalı ve %s içermeli.</span>
        {/if}
      </div>
    {/if}

    <h2>Varsayılan tarayıcı</h2>
    <div class="row">
      <span class="label">
        <span>{view.defaultBrowser ? 'Yalqen varsayılan tarayıcınız' : 'Yalqen varsayılan tarayıcı değil'}</span>
        <span class="hint">Diğer uygulamalardaki bağlantılar varsayılan tarayıcıda açılır.</span>
      </span>
      {#if !view.defaultBrowser}
        <button class="primary" onclick={async () => (view = await api.makeDefault())}>Varsayılan yap</button>
      {/if}
    </div>

    <h2>Açılış</h2>
    <div class="row">
      <span class="label">
        <span>Tarayıcı açıldığında</span>
        <span class="hint">Yeni sekmeyle başla seçilirse, tarayıcı kapandığında açık sekmeler kaydedilmez.</span>
      </span>
      <select
        aria-label="Tarayıcı açıldığında"
        value={values.startupBehavior}
        onchange={(event) =>
          update({ startupBehavior: event.currentTarget.value as SettingsValues['startupBehavior'] })}
      >
        {#each startupOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <h2>Sekme paneli</h2>
    <div class="row">
      <span class="label">Görünüm</span>
      <div class="segmented" role="group" aria-label="Panel görünümü">
        {#each panelOptions as option (option.label)}
          <button
            aria-pressed={values.panelCollapsed === option.value}
            onclick={() => update({ panelCollapsed: option.value })}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="label">Konum</span>
      <div class="segmented" role="group" aria-label="Panel konumu">
        {#each sideOptions as option (option.value)}
          <button aria-pressed={values.panelSide === option.value} onclick={() => update({ panelSide: option.value })}>
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <h2>Görünüm</h2>
    <div class="row">
      <span class="label">Tema</span>
      <div class="segmented" role="group" aria-label="Tema">
        {#each themeOptions as option (option.value)}
          <button
            aria-pressed={values.theme === option.value}
            onclick={() => update({ theme: option.value })}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <h2>Gizlilik</h2>
    <div class="row">
      <span class="label">
        <span>Reklam engelleyici</span>
        <span class="hint">EasyList ve uBlock Origin filtreleriyle reklamları engeller. Değişiklik yeni yüklenen sayfalarda geçerli olur.</span>
      </span>
      <div class="segmented" role="group" aria-label="Reklam engelleyici">
        {#each onOffOptions as option (option.label)}
          <button
            aria-pressed={values.adBlocking === option.value}
            onclick={() => update({ adBlocking: option.value })}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="row stacked">
      <span class="label">
        <span>Tarama verilerini temizle</span>
        <span class="hint">Geçmiş ve indirme listesi seçilen aralıktan silinir. Çerezler, site verileri ve önbellek her zaman tümüyle silinir.</span>
      </span>
      <div class="clear">
        <select aria-label="Zaman aralığı" bind:value={clearRange} onchange={() => (cleared = false)}>
          {#each rangeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#each clearOptions as option (option.key)}
          <label class="check">
            <input type="checkbox" bind:checked={clearKinds[option.key]} onchange={() => (cleared = false)} />
            {option.label}
          </label>
        {/each}
        <div class="clear-actions">
          <button class="primary" disabled={!clearSelected || clearing} onclick={clearData}>
            {clearing ? 'Temizleniyor…' : 'Verileri temizle'}
          </button>
          {#if cleared}<span class="hint" role="status">Temizlendi.</span>{/if}
        </div>
      </div>
    </div>

    <h2>Bellek</h2>
    <div class="row last">
      <span class="label">
        <span>Arka plan sekmelerini dondur</span>
        <span class="hint">Sekme değişince eski sekmedeki kod ve animasyonlar durur. Ses çalan ve canlı tutulan sekmeler dondurulmaz.</span>
      </span>
      <div class="segmented" role="group" aria-label="Arka plan sekmelerini dondur">
        {#each onOffOptions as option (option.label)}
          <button
            aria-pressed={values.freezeBackgroundTabs === option.value}
            onclick={() => update({ freezeBackgroundTabs: option.value })}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </main>
{/if}

<style>
  :global(body) {
    overflow-y: auto;
    background: var(--surface);
  }

  .settings {
    display: flex;
    flex-direction: column;
    padding: 8px 24px 24px;
  }

  h2 {
    margin: 20px 0 4px;
    color: var(--text-muted);
    font-size: var(--font-size-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h2:first-child {
    margin-top: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .row.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .row.last {
    border-bottom: 0;
  }

  .label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hint {
    color: var(--text-muted);
    font-size: var(--font-size-small);
  }

  select,
  input {
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font: inherit;
  }

  input {
    font-size: 12px;
    user-select: text;
  }

  input.invalid {
    border-color: var(--warn);
  }

  .error {
    color: var(--warn);
    font-size: var(--font-size-small);
  }

  .clear {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .check input {
    height: auto;
    margin: 0;
    padding: 0;
  }

  .clear-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .primary {
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }

  .primary:disabled {
    opacity: 0.5;
  }

  .segmented {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius);
    background: var(--surface-hover);
  }

  .segmented button {
    height: 26px;
    padding: 0 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    transition: background var(--transition);
  }

  .segmented button[aria-pressed='true'] {
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
  }
</style>
