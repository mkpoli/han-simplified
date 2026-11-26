<script lang="ts">
  import { goto } from '$app/navigation'
  import ZoomablePicture from '$lib/components/ZoomablePicture.svelte'
  import { schemeLang } from '$lib/data/schema'
  import { pageImageUrl, pageSrcset } from '$lib/media'
  import { href, t } from '$lib/t'

  let { data } = $props()

  const scheme = $derived(data.scheme)
  const edition = $derived(data.edition)
  const current = $derived(data.page)
  const lang = $derived(schemeLang(scheme))

  function pageHref(seq: number): string {
    return href(`/scheme/${scheme.id}/page/${seq}`)
  }

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    if (event.key === 'PageUp' && data.prevSeq !== null) {
      event.preventDefault()
      void goto(pageHref(data.prevSeq))
    } else if (event.key === 'PageDown' && data.nextSeq !== null) {
      event.preventDefault()
      void goto(pageHref(data.nextSeq))
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>{current.printed_label} · {scheme.year} {scheme.title} · {t('app.name')}</title>
  <meta name="description" content={t('app.description')} />
</svelte:head>

<div class="book-page">
  <header class="book-bar">
    <nav class="crumb" aria-label={t('nav.navigation')}>
      <a class="text-link" href={href('/schemes')}>{t('nav.schemes')}</a>
      <span aria-hidden="true">/</span>
      <a class="text-link" href={href(`/scheme/${scheme.id}`)} {lang}>{scheme.year} {scheme.title}</a>
      <span aria-hidden="true">/</span>
      <span class="current-label">{current.printed_label}</span>
    </nav>

    <div class="pager" role="navigation" aria-label={t('book.pages')}>
      {#if data.prevSeq !== null}
        <a class="ga-button" href={pageHref(data.prevSeq)} aria-label={t('book.prevPage')}>← {t('book.prevPage')}</a>
      {:else}
        <span class="ga-button is-disabled" aria-disabled="true">← {t('book.prevPage')}</span>
      {/if}

      <span class="page-pos mono">{current.seq} / {data.pages.length}</span>

      {#if data.nextSeq !== null}
        <a class="ga-button" href={pageHref(data.nextSeq)} aria-label={t('book.nextPage')}>{t('book.nextPage')} →</a>
      {:else}
        <span class="ga-button is-disabled" aria-disabled="true">{t('book.nextPage')} →</span>
      {/if}
    </div>
  </header>

  <div class="reader">
    <div class="scan-pane">
      <ZoomablePicture
        src={pageImageUrl(current.image_key, 1600)}
        srcset={pageSrcset(current.image_key, current.width)}
        sizes="(max-width: 960px) 100vw, 66vw"
        alt={`${scheme.title} · ${current.printed_label}`}
        width={current.width}
        height={current.height}
        loading="eager"
      />
      <div class="scan-foot">
        <span class="mono muted">{current.width}×{current.height}</span>
        <a
          class="text-link small"
          href={pageImageUrl(current.image_key, 'full')}
          target="_blank"
          rel="noopener"
        >
          {t('book.openFull')} ↗
        </a>
      </div>
    </div>

    <aside class="side-pane">
      <section class="ga-card side-card">
        <h2 {lang}>{scheme.title}</h2>
        <p class="muted small" {lang}>{edition.imprint || edition.title}</p>
        <dl class="facts">
          <div><dt>{t('book.pageLabel')}</dt><dd>{current.printed_label}</dd></div>
          <div><dt>{t('book.sequence')}</dt><dd class="mono">{current.seq} / {data.pages.length}</dd></div>
          <div><dt>{t('book.edition')}</dt><dd class="mono">{edition.id}</dd></div>
        </dl>
      </section>

      <section class="ga-card side-card">
        <h3>{t('book.pages')}</h3>
        <ol class="strip">
          {#each data.pages as p (p.seq)}
            <li>
              <a
                class="strip-item"
                class:is-current={p.seq === current.seq}
                aria-current={p.seq === current.seq ? 'page' : undefined}
                href={pageHref(p.seq)}
              >
                <span class="strip-thumb">
                  <img
                    src={pageImageUrl(p.image_key, 320)}
                    alt={p.printed_label}
                    width={p.width}
                    height={p.height}
                    loading="lazy"
                  />
                </span>
                <span class="strip-label">{p.printed_label}</span>
              </a>
            </li>
          {/each}
        </ol>
      </section>
    </aside>
  </div>
</div>

<style>
  .book-page {
    inline-size: 100%;
    max-inline-size: 1440px;
    margin-inline: auto;
    padding: 18px var(--page-gutter) 56px;
    display: grid;
    gap: 16px;
  }

  .book-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 20px;
    padding-block-end: 12px;
    border-block-end: 1px solid var(--line);
  }

  .crumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .current-label {
    color: var(--ink);
    font-weight: 550;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pager .ga-button {
    min-block-size: 36px;
    padding: 6px 12px;
    font-size: 13px;
  }

  .pager .is-disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .page-pos {
    color: var(--muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    padding-inline: 4px;
  }

  .reader {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 20px;
    align-items: start;
  }

  .scan-pane {
    display: grid;
    gap: 8px;
    min-inline-size: 0;
  }

  .scan-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  .side-pane {
    display: grid;
    gap: 14px;
    min-inline-size: 0;
  }

  .side-card {
    display: grid;
    gap: 10px;
    padding: 16px;
  }

  .side-card h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .side-card h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }

  .facts {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-block-start: 8px;
    border-block-start: 1px solid var(--line);
    font-size: 13px;
  }

  .facts > div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .facts dt {
    color: var(--muted);
  }

  .facts dd {
    margin: 0;
    text-align: end;
  }

  .strip {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .strip-item {
    display: grid;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-xs);
    background: var(--paper);
    text-align: center;
  }

  .strip-item:hover {
    border-color: var(--line-strong);
  }

  .strip-item.is-current {
    border-color: var(--accent);
    background: var(--accent-light);
  }

  .strip-thumb {
    display: block;
    background: var(--scan-paper);
    border-radius: 2px;
    overflow: hidden;
  }

  .strip-thumb img {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  .strip-label {
    font-size: 12px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 960px) {
    .reader {
      grid-template-columns: 1fr;
    }

    .strip {
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    }
  }
</style>
