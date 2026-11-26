<script lang="ts">
  import { page } from '$app/state'
  import {
    COUNTRIES,
    SCHEME_STATES,
    schemeLang,
    type Country,
    type SchemeRow,
    type SchemeState,
  } from '$lib/data/schema'
  import {
    filterSchemes,
    groupSchemesByCountry,
    isCountry,
    isSchemeState,
    REPLACED_BY,
    SCHEME_BY_ID,
    SCHEMES,
  } from '$lib/data/schemes'
  import { href, t } from '$lib/t'

  const activeCountry = $derived<Country | null>(
    isCountry(page.url.searchParams.get('country'))
      ? (page.url.searchParams.get('country') as Country)
      : null,
  )
  const activeState = $derived<SchemeState | null>(
    isSchemeState(page.url.searchParams.get('state'))
      ? (page.url.searchParams.get('state') as SchemeState)
      : null,
  )

  const filtered = $derived(
    filterSchemes(SCHEMES, { country: activeCountry, state: activeState }),
  )
  const visibleIds = $derived(new Set(filtered.map((s) => s.id)))
  const groups = $derived(groupSchemesByCountry(filtered))

  const countryCounts = $derived(
    Object.fromEntries(
      COUNTRIES.map((c) => [c, filterSchemes(SCHEMES, { country: c, state: activeState }).length]),
    ) as Record<Country, number>,
  )
  const stateCounts = $derived(
    Object.fromEntries(
      SCHEME_STATES.map((st) => [
        st,
        filterSchemes(SCHEMES, { country: activeCountry, state: st }).length,
      ]),
    ) as Record<SchemeState, number>,
  )

  function filterUrl(next: { country?: Country | null; state?: SchemeState | null }): string {
    const params = new URLSearchParams()
    const c = next.country !== undefined ? next.country : activeCountry
    const st = next.state !== undefined ? next.state : activeState
    if (c) params.set('country', c)
    if (st) params.set('state', st)
    const qs = params.toString()
    return `${href('/schemes')}${qs ? `?${qs}` : ''}`
  }

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

  function schemeRefHref(id: string): string {
    return visibleIds.has(id) ? `#${id}` : `${href('/schemes')}#${id}`
  }
</script>

<svelte:head>
  <title>{t('page.schemesTitle')} · {t('app.name')}</title>
  <meta name="description" content={t('app.description')} />
</svelte:head>

<div class="page stack">
  <header class="head-row">
    <h1>{t('page.schemesTitle')}</h1>
    <span class="total-count">{filtered.length}</span>
  </header>

  <div class="filters">
    <nav class="ga-tabs filter-strip" aria-label={t('scheme.filterCountry')}>
      <a
        href={filterUrl({ country: null })}
        class="ga-tab"
        class:is-active={activeCountry === null}
        aria-current={activeCountry === null ? 'true' : undefined}
        data-sveltekit-noscroll
      >
        <span>{t('country.all')}</span>
        <span class="tab-count">{filterSchemes(SCHEMES, { state: activeState }).length}</span>
      </a>
      {#each COUNTRIES as country (country)}
        <a
          href={filterUrl({ country })}
          class="ga-tab"
          class:is-active={activeCountry === country}
          aria-current={activeCountry === country ? 'true' : undefined}
          data-sveltekit-noscroll
        >
          <span>{t(`country.${country}`)}</span>
          <span class="tab-count">{countryCounts[country]}</span>
        </a>
      {/each}
    </nav>

    <nav class="ga-tabs filter-strip" aria-label={t('scheme.filterState')}>
      <a
        href={filterUrl({ state: null })}
        class="ga-tab"
        class:is-active={activeState === null}
        aria-current={activeState === null ? 'true' : undefined}
        data-sveltekit-noscroll
      >
        <span>{t('scheme.stateAll')}</span>
      </a>
      {#each SCHEME_STATES as st (st)}
        <a
          href={filterUrl({ state: st })}
          class="ga-tab"
          class:is-active={activeState === st}
          aria-current={activeState === st ? 'true' : undefined}
          data-sveltekit-noscroll
        >
          <span>{t(`state.${st}`)}</span>
          <span class="tab-count">{stateCounts[st]}</span>
        </a>
      {/each}
    </nav>
  </div>

  {#if groups.length === 0}
    <div class="ga-empty">
      <span class="ga-empty__mark" aria-hidden="true">·</span>
      <h2 class="ga-empty__title">{t('scheme.emptyTitle')}</h2>
      <a class="ga-button" href={href('/schemes')}>{t('scheme.clearFilters')}</a>
    </div>
  {:else}
    <div class="country-list">
      {#each groups as group (group.country)}
        <section class="country-section" aria-labelledby={`country-${group.country}`}>
          <header class="country-head">
            <h2 id={`country-${group.country}`}>{t(`country.${group.country}`)}</h2>
            <span class="section-count">{group.schemes.length}</span>
          </header>

          <ol class="timeline">
            {#each group.schemes as scheme (scheme.id)}
              {@const successors = REPLACED_BY.get(scheme.id) ?? []}
              {@const lang = schemeLang(scheme)}
              <li id={scheme.id} class="timeline-item">
                <div class="year-col">
                  <span class="year">{scheme.year}</span>
                  <code class="scheme-id">{scheme.id}</code>
                </div>

                <article class="scheme-card">
                  <div class="card-top">
                    <h3 class="scheme-title" {lang}>{scheme.title}</h3>
                    <div class="badges">
                      <span class={stateBadgeClass(scheme.state)}>
                        {#if scheme.state === 'checked'}✓ {/if}{t(`state.${scheme.state}`)}
                      </span>
                      <span class={kindBadgeClass(scheme.kind)}>
                        {#if scheme.kind === 'adopted'}<span class="ga-badge__dot" aria-hidden="true"></span>{/if}{t(`scheme.kind.${scheme.kind}`)}
                      </span>
                      <span class="ga-badge">{t(`scheme.coverage.${scheme.coverage}`)}</span>
                    </div>
                  </div>

                  <div class="meta">
                    <span class="body-name" {lang}>{scheme.body}</span>
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

                  {#if scheme.replaces.length > 0 || successors.length > 0}
                    <div class="relations">
                      {#if scheme.replaces.length > 0}
                        <span class="rel-group">
                          <span class="rel-label">{t('scheme.replaces')}</span>
                          {#each scheme.replaces as prevId (prevId)}
                            {@const prev = SCHEME_BY_ID.get(prevId)}
                            <a class="rel-link" href={schemeRefHref(prevId)}>
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
                      {#if successors.length > 0}
                        <span class="rel-group">
                          <span class="rel-label">{t('scheme.replacedBy')}</span>
                          {#each successors as next (next.id)}
                            <a class="rel-link" href={schemeRefHref(next.id)}>
                              <span aria-hidden="true">→</span>
                              <span class="mono">{next.year}</span>
                              <span lang={schemeLang(next)}>{next.title}</span>
                            </a>
                          {/each}
                        </span>
                      {/if}
                    </div>
                  {/if}
                </article>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .head-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .total-count,
  .section-count {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
    padding-block: 12px;
    border-block: 1px solid var(--line);
  }

  .filter-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .filter-strip .ga-tab {
    gap: 6px;
    padding-inline: 12px;
    min-block-size: 36px;
  }

  .tab-count {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .country-list {
    display: grid;
    gap: 36px;
  }

  .country-section {
    display: grid;
    gap: 16px;
  }

  .country-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-block-end: 8px;
    border-block-end: 1px solid var(--line);
  }

  .country-head h2 {
    font-size: var(--ga-text-xl);
    font-weight: 600;
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    scroll-margin-top: 24px;
  }

  .timeline-item:target .scheme-card {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-light);
  }

  .year-col {
    display: grid;
    gap: 2px;
    padding-block-start: 14px;
    padding-inline-end: 12px;
    border-inline-end: 2px solid var(--line);
    text-align: end;
  }

  .year {
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .scheme-id {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
  }

  .scheme-card {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--surface);
  }

  .card-top {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 16px;
  }

  .scheme-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 18px;
    color: var(--muted);
    font-size: 13px;
  }

  .dates {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 18px;
    margin: 0;
  }

  .meta-item {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
  }

  .meta-item dt {
    color: var(--muted);
    font-size: 12px;
  }

  .meta-item dd {
    margin: 0;
    color: var(--ink);
  }

  .body-name {
    color: var(--muted);
  }

  .meta-item.is-withdrawn dt,
  .meta-item.is-withdrawn dd {
    color: var(--wrong);
  }

  .relations {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    padding-block-start: 6px;
    border-block-start: 1px solid var(--line);
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

  @media (max-width: 640px) {
    .timeline-item {
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .year-col {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 0;
      border-inline-end: 0;
      text-align: start;
    }
  }
</style>
