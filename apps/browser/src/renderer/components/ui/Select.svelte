<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';

  let {
    value = $bindable(),
    size = 'md',
    children,
    class: className,
    ...rest
  }: Omit<HTMLSelectAttributes, 'size' | 'children'> & {
    size?: 'md' | 'lg';
    children: Snippet;
  } = $props();
</script>

<select bind:value class={['field', size, className]} {...rest}>
  {@render children()}
</select>
