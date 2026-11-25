<script lang="ts">
  let { size = 26 }: { size?: number } = $props()
</script>

<svg viewBox="0 0 32 32" fill="none" width={size} height={size} aria-hidden="true">
  <path d="M4 4h9v9H4z" fill="currentColor" />
  <path d="M19 4h9v9h-9z" fill="currentColor" />
  <path d="M4 19h9v9H4z" fill="currentColor" />
  <path
    d="M19 20.25h9M19 24h5.5M26.5 20.25V28"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="square"
  />
</svg>
