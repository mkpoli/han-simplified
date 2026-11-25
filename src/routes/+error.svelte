<script lang="ts">
  import { page } from '$app/state'
  import { href, t } from '$lib/t'

  const message = $derived(page.status === 404 ? t('error.notFound') : t('error.title'))
</script>

<svelte:head>
  <title>{message} · {t('app.name')}</title>
</svelte:head>

<div class="page narrow stack">
  <h1>{page.status}</h1>
  <p>{message}</p>
  <p><a class="text-link" href={href()}>{t('error.home')}</a></p>
</div>
