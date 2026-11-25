<script lang="ts">
  import { t } from '$lib/t'
</script>

<svelte:head>
  <title>{t('page.sourcesTitle')} · {t('app.name')}</title>
</svelte:head>

<div class="page stack">
  <h1>{t('page.sourcesTitle')}</h1>
  <p class="muted">{t('page.pending')}</p>
</div>
