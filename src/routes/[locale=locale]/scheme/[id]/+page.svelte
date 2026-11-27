<script lang="ts">
  import { sectionLabel } from '$lib/data/forms'
  import { schemeLang, type SchemeRow, type SchemeState } from '$lib/data/schema'
  import { SCHEME_BY_ID } from '$lib/data/schemes'
  import { pageImageUrl } from '$lib/media'
  import { href, t } from '$lib/t'

  let { data } = $props()

  const scheme = $derived(data.scheme)
  const lang = $derived(schemeLang(scheme))

  function stateBadgeClass(state: SchemeState): string {
    if (state === 'checked') return 'ga-badge ga-badge--checked'
    if (state === 'transcribed') return 'ga-badge ga-badge--transcribed'
    return 'ga-badge ga-badge--listed'
  }

  function kindBadgeClass(kind: SchemeRow['kind']): string {
    if (kind === 'withdrawn') return 'ga-badge ga-badge--wrong'
    if (kind === 'adopted') return 'ga-badge ga-badge--live'
    return 'ga-badge'
  }
</script>

<svelte:head>
  <title>{scheme.year} {scheme.title} · {t('app.name')}</title>
  <meta name="description" content={t('app.description')} />
</svelte:head>

<div class="page stack">
  <nav class="crumb" aria-label={t('nav.navigation')}>
    <a class="text-link" href={href('/schemes')}>{t('nav.schemes')}</a>
    <span aria-hidden="true">/</span>
    <span class="mono">{scheme.id}</span>
  </nav>

  <header class="scheme-head">
    <div class="head-main">
      <div class="title-row">
        <span class="year">{scheme.year}</span>
        <h1 {lang}>{scheme.title}</h1>
      </div>
      <div class="badges">
        <span class={stateBadgeClass(scheme.state)}>
          {#if scheme.state === 'checked'}✓ {/if}{t(`state.${scheme.state}`)}
        </span>
        <span class={kindBadgeClass(scheme.kind)}>
          {#if scheme.kind === 'adopted'}<span class="ga-badge__dot" aria-hidden="true"></span>{/if}{t(`scheme.kind.${scheme.kind}`)}
        </span>
        <span class="ga-badge">{t(`scheme.coverage.${scheme.coverage}`)}</span>
        <span class="ga-badge">{t(`country.${scheme.country}`)}</span>
      </div>
      <div class="meta">
        <span {lang}>{scheme.body}</span>
        {#if scheme.adopted_on || scheme.withdrawn_on}
          <dl class="dates">
            {#if scheme.adopted_on}
              <div class="meta-item">
                <dt>{scheme.kind === 'civic' ? t('scheme.publishedOn') : t('scheme.adoptedOn')}</dt>
                <dd class="mono">{scheme.adopted_on}</dd>
              </div>
            {/if}
            {#if scheme.withdrawn_on}
              <div class="meta-item is-withdrawn">
                <dt>{t('scheme.withdrawnOn')}</dt>
                <dd class="mono">{scheme.withdrawn_on}</dd>
              </div>
            {/if}
          </dl>
        {/if}
      </div>

      {#if scheme.replaces.length > 0 || data.successors.length > 0}
        <div class="relations">
          {#if scheme.replaces.length > 0}
            <span class="rel-group">
              <span class="rel-label">{t('scheme.replaces')}</span>
              {#each scheme.replaces as prevId (prevId)}
                {@const prev = SCHEME_BY_ID.get(prevId)}
                <a class="rel-link" href={href(`/scheme/${prevId}`)}>
                  <span aria-hidden="true">←</span>
                  {#if prev}
                    <span class="mono">{prev.year}</span>
                    <span lang={schemeLang(prev)}>{prev.title}</span>
                  {:else}
                    <span class="mono">{prevId}</span>
                  {/if}
                </a>
              {/each}
            </span>
          {/if}
          {#if data.successors.length > 0}
            <span class="rel-group">
              <span class="rel-label">{t('scheme.replacedBy')}</span>
              {#each data.successors as next (next.id)}
                <a class="rel-link" href={href(`/scheme/${next.id}`)}>
                  <span aria-hidden="true">→</span>
                  <span class="mono">{next.year}</span>
                  <span lang={schemeLang(next)}>{next.title}</span>
                </a>
              {/each}
            </span>
          {/if}
        </div>
      {/if}
    </div>

    {#if data.pages.length > 0}
      <a class="cover-link" href={href(`/scheme/${scheme.id}/page/1`)}>
        <img
          src={pageImageUrl(data.pages[0].image_key, 320)}
          alt={`${scheme.title} ${data.pages[0].printed_label}`}
          width={data.pages[0].width}
          height={data.pages[0].height}
          loading="eager"
        />
      </a>
    {/if}
  </header>

  {#if data.checks.length > 0}
    <section class="section">
      <div class="section-head">
        <h2 id="totals-heading">{t('book.totals')}</h2>
        <span class="count-label">{data.checks.length}</span>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-wrap"
        tabindex="0"
        role="region"
        aria-labelledby="totals-heading"
        style:--lbl-section={`"${t('book.section')}"`}
        style:--lbl-metric={`"${t('book.metric')}"`}
        style:--lbl-printed={`"${t('book.printed')}"`}
        style:--lbl-counted={`"${t('book.counted')}"`}
        style:--lbl-note={`"${t('book.note')}"`}
      >
        <table class="totals-table">
          <thead>
            <tr>
              <th scope="col">{t('book.section')}</th>
              <th scope="col">{t('book.metric')}</th>
              <th scope="col" class="num">{t('book.printed')}</th>
              <th scope="col" class="num">{t('book.counted')}</th>
              <th scope="col">{t('book.note')}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.checks as chk (chk.section + '#' + chk.metric)}
              {@const exact = chk.printed === chk.counted}
              <tr>
                <th scope="row" {lang}>{sectionLabel(chk.section)}</th>
                <td data-col="metric">{t(`book.metric.${chk.metric}`)}</td>
                <td data-col="printed" class="num mono">{chk.printed}</td>
                <td data-col="counted" class="num mono" class:is-exact={exact} class:is-diff={!exact}>
                  {chk.counted}{#if exact} ✓{/if}
                </td>
                <td data-col="note" class="note-cell">{chk.note || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if data.editions.length > 0}
    <section class="section">
      <div class="section-head">
        <h2>{t('book.pages')}</h2>
        <span class="count-label">{data.pages.length}</span>
      </div>

      <ol class="page-grid">
        {#each data.pages as p (p.seq)}
          {@const count = data.entryCounts[p.seq] ?? 0}
          <li>
            <a class="page-card" href={href(`/scheme/${scheme.id}/page/${p.seq}`)}>
              <span class="thumb-frame">
                <img
                  src={pageImageUrl(p.image_key, 320)}
                  alt={`${scheme.title} · ${p.printed_label}`}
                  width={p.width}
                  height={p.height}
                  loading={p.seq <= 4 ? 'eager' : 'lazy'}
                />
              </span>
              <span class="thumb-meta">
                <span class="thumb-label">{p.printed_label}</span>
                {#if count > 0}
                  <span class="mono thumb-count">{t('book.entryCount', { n: count })}</span>
                {:else}
                  <span class="mono thumb-seq">#{p.seq}</span>
                {/if}
              </span>
            </a>
          </li>
        {/each}
      </ol>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>{t('book.editions')}</h2>
        <span class="count-label">{data.editions.length}</span>
      </div>
      <div class="edition-list">
        {#each data.editions as ed (ed.id)}
          <article class="ga-card edition-card">
            <div class="edition-top">
              <h3 {lang}>{ed.title}</h3>
              <code class="mono">{ed.id}</code>
            </div>
            {#if ed.imprint}<p class="muted" {lang}>{ed.imprint}</p>{/if}
            <dl class="edition-meta">
              {#if ed.holder}
                <div><dt>{t('book.holder')}</dt><dd>{ed.holder}</dd></div>
              {/if}
              {#if ed.retrieved_on}
                <div><dt>{t('book.retrievedOn')}</dt><dd class="mono">{ed.retrieved_on}</dd></div>
              {/if}
              {#if ed.sha256}
                <div><dt>SHA-256</dt><dd class="mono">{ed.sha256.slice(0, 16)}…</dd></div>
              {/if}
            </dl>
          </article>
        {/each}
      </div>
    </section>
  {:else}
    <div class="ga-empty">
      <span class="ga-empty__mark" aria-hidden="true">·</span>
      <h2 class="ga-empty__title">{t('book.noScans')}</h2>
      <a class="ga-button" href={href('/schemes')}>{t('nav.schemes')}</a>
    </div>
  {/if}
</div>

<style>
  .crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .scheme-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 156px;
    gap: 24px;
    align-items: start;
    padding-block-end: 24px;
    border-block-end: 1px solid var(--line);
  }

  .head-main {
    display: grid;
    gap: 12px;
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 14px;
  }

  .year {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 18px;
    color: var(--muted);
    font-size: 14px;
  }

  .dates {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin: 0;
  }

  .meta-item {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .meta-item dt {
    font-size: 12px;
    color: var(--muted);
  }

  .meta-item dd {
    margin: 0;
    color: var(--ink);
  }

  .meta-item.is-withdrawn dt,
  .meta-item.is-withdrawn dd {
    color: var(--wrong);
  }

  .relations {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    font-size: 13px;
  }

  .rel-group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
  }

  .rel-label {
    color: var(--muted);
    font-size: 12px;
  }

  .rel-link {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .rel-link:hover {
    color: var(--accent);
  }

  .cover-link {
    display: block;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--scan-paper);
    overflow: hidden;
  }

  .cover-link:hover {
    border-color: var(--line-strong);
  }

  .cover-link img {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  .section {
    display: grid;
    gap: 16px;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .count-label {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .table-wrap {
    overflow: auto;
    max-inline-size: 100%;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--surface);
    container-type: inline-size;
  }

  .table-wrap:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .totals-table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
  }

  .totals-table thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    background: var(--surface-sunken);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    text-align: start;
    padding: 9px 12px;
    border-block-end: 1px solid var(--line);
    white-space: nowrap;
  }

  .totals-table tbody th,
  .totals-table tbody td {
    padding: 9px 12px;
    border-block-end: 1px solid var(--line);
    text-align: start;
    vertical-align: top;
  }

  .totals-table tbody tr:last-child th,
  .totals-table tbody tr:last-child td {
    border-block-end: 0;
  }

  .totals-table tbody th {
    font-weight: 550;
    color: var(--ink);
    white-space: nowrap;
  }

  .totals-table .num {
    text-align: end;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .totals-table .is-exact {
    color: var(--good);
    font-weight: 600;
  }

  .totals-table .is-diff {
    color: var(--ink);
    font-weight: 600;
  }

  .totals-table .note-cell {
    color: var(--muted);
    max-inline-size: 46ch;
  }

  @container (width < 600px) {
    .totals-table,
    .totals-table thead,
    .totals-table tbody,
    .totals-table tr,
    .totals-table th,
    .totals-table td {
      display: block;
    }

    .totals-table thead {
      display: none;
    }

    .totals-table tbody tr {
      padding: 10px 12px;
      border-block-end: 1px solid var(--line);
    }

    .totals-table tbody tr:last-child {
      border-block-end: 0;
    }

    .totals-table tbody th,
    .totals-table tbody td {
      border: 0;
      padding: 3px 0;
      text-align: start;
      white-space: normal;
    }

    .totals-table .num {
      text-align: start;
    }

    .totals-table td[data-col='metric']::before {
      content: var(--lbl-metric) ': ';
      color: var(--muted);
      font-size: 12px;
    }

    .totals-table td[data-col='printed']::before {
      content: var(--lbl-printed) ': ';
      color: var(--muted);
      font-family: var(--ga-font-sans);
      font-size: 12px;
    }

    .totals-table td[data-col='counted']::before {
      content: var(--lbl-counted) ': ';
      color: var(--muted);
      font-family: var(--ga-font-sans);
      font-size: 12px;
      font-weight: 400;
    }

    .totals-table td[data-col='note']::before {
      content: var(--lbl-note) ': ';
      color: var(--muted);
      font-size: 12px;
    }
  }

  .page-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 16px;
  }

  .page-card {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--surface);
  }

  .page-card:hover {
    border-color: var(--line-strong);
  }

  .thumb-frame {
    display: block;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-xs);
    background: var(--scan-paper);
    overflow: hidden;
  }

  .thumb-frame img {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  .thumb-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .thumb-label {
    font-size: 13px;
    font-weight: 550;
  }

  .thumb-seq,
  .thumb-count {
    color: var(--muted);
    font-size: 12px;
  }

  .edition-list {
    display: grid;
    gap: 12px;
  }

  .edition-card {
    display: grid;
    gap: 8px;
  }

  .edition-top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .edition-top h3 {
    font-size: 15px;
    font-weight: 600;
  }

  .edition-top code {
    color: var(--muted);
    font-size: 12px;
  }

  .edition-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin: 0;
    font-size: 13px;
  }

  .edition-meta > div {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .edition-meta dt {
    color: var(--muted);
    font-size: 12px;
  }

  .edition-meta dd {
    margin: 0;
  }

  @media (max-width: 640px) {
    .scheme-head {
      grid-template-columns: 1fr;
    }

    .cover-link {
      max-inline-size: 180px;
    }
  }
</style>
