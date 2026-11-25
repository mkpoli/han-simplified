<script lang="ts">
  import { t } from '$lib/t'
</script>

<svelte:head>
  <title>{t('app.name')}</title>
  <meta name="description" content={t('app.description')} />
</svelte:head>

<div class="page stack">
  <h1>{t('page.tableTitle')}</h1>
  <p class="muted">{t('page.pending')}</p>
  <p><a class="text-link" href="/design">{t('nav.design')}</a></p>
</div>
