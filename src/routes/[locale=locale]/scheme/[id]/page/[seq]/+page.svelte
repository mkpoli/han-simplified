<script lang="ts">
  import { goto, replaceState } from '$app/navigation'
  import { tick } from 'svelte'
  import ZoomablePicture from '$lib/components/ZoomablePicture.svelte'
  import { sectionLabel } from '$lib/data/forms'
  import { schemeLang, type SightingRow } from '$lib/data/schema'
  import { pageImageUrl, pageSrcset } from '$lib/media'
  import { href, t } from '$lib/t'
  import { clampZoom, confinePan, type Pan } from '$lib/zoom'
  import type { PageEntryItem } from './+page'

  let { data } = $props()

  const scheme = $derived(data.scheme)
  const edition = $derived(data.edition)
  const current = $derived(data.page)
  const lang = $derived(schemeLang(scheme))
  const items = $derived(data.pageEntries)

  let showBoxes = $state(true)
  let hoveredId = $state<string | null>(null)
  let selectedId = $state<string | null>(null)
  let zoom = $state(1)
  let pan = $state<Pan>({ x: 0, y: 0 })
  let imageEl = $state<HTMLImageElement | undefined>(undefined)
  let frameEl = $state<HTMLElement | undefined>(undefined)
  let listEl = $state<HTMLElement | undefined>(undefined)

  const activeId = $derived(hoveredId ?? selectedId)

  // Group entries by section in printed order
  const sections = $derived.by(() => {
    const groups: Array<{ section: string; items: PageEntryItem[] }> = []
    for (const item of items) {
      const last = groups[groups.length - 1]
      if (last && last.section === item.entry.section) {
        last.items.push(item)
      } else {
        groups.push({ section: item.entry.section, items: [item] })
      }
    }
    return groups
  })

  // Flatten distinct visual boxes for overlay (dedupe identical base/form boxes on T2(8) analogical chars)
  interface OverlayBox {
    key: string
    entryId: string
    role: 'base' | 'form' | 'pair'
    x: number
    y: number
    w: number
    h: number
    label: string
  }

  const overlayBoxes = $derived.by(() => {
    const out: OverlayBox[] = []
    const seenPair = new Set<string>()
    for (const item of items) {
      const baseText = item.bases.map((b) => b.rendered.text || b.rendered.ids || '□').join('')
      const formText = item.formRendered.text || item.formRendered.ids || t('book.unencoded')
      const label = `${baseText} → ${formText}`

      // Merge identical base+form box (as on analogical base-only lists)
      const byCoords = new Map<string, SightingRow[]>()
      for (const s of item.sightings) {
        const ck = `${s.x},${s.y},${s.w},${s.h}`
        const list = byCoords.get(ck) ?? []
        list.push(s)
        byCoords.set(ck, list)
      }
      for (const [ck, group] of byCoords) {
        const dedupeKey = `${item.entry.printed_row}:${ck}`
        // Skip duplicate overlay when two footnote-split entries share exact coordinates
        if (seenPair.has(dedupeKey)) continue
        seenPair.add(dedupeKey)
        const s = group[0]
        const role: OverlayBox['role'] = group.length > 1 ? 'pair' : s.role
        out.push({
          key: `${item.entry.id}-${role}-${s.pos}-${ck}`,
          entryId: item.entry.id,
          role,
          x: s.x,
          y: s.y,
          w: s.w,
          h: s.h,
          label,
        })
      }
    }
    return out
  })

  function pageHref(seq: number): string {
    return href(`/scheme/${scheme.id}/page/${seq}`)
  }

  function unionBox(item: PageEntryItem): { x: number; y: number; w: number; h: number } | null {
    if (item.sightings.length === 0) return null
    let minX = 1
    let minY = 1
    let maxX = 0
    let maxY = 0
    for (const s of item.sightings) {
      minX = Math.min(minX, s.x)
      minY = Math.min(minY, s.y)
      maxX = Math.max(maxX, s.x + s.w)
      maxY = Math.max(maxY, s.y + s.h)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  function focusEntryOnScan(item: PageEntryItem) {
    const box = unionBox(item)
    if (!box || !imageEl || !frameEl) return
    const pic = { width: imageEl.offsetWidth, height: imageEl.offsetHeight }
    const frame = { width: frameEl.clientWidth, height: frameEl.clientHeight }
    if (pic.width <= 0 || pic.height <= 0 || frame.width <= 0 || frame.height <= 0) return
    const targetZoom = clampZoom(Math.max(zoom, 2.2))
    const cx = (box.x + box.w / 2 - 0.5) * pic.width
    const cy = (box.y + box.h / 2 - 0.5) * pic.height
    zoom = targetZoom
    pan = confinePan({ x: -cx * targetZoom, y: -cy * targetZoom }, targetZoom, pic, frame)
  }

  function scrollRowIntoView(entryId: string, focusRow = false) {
    if (!listEl) return
    const row = listEl.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(entryId)}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (focusRow) {
      row?.querySelector<HTMLButtonElement>('.pair-btn')?.focus({ preventScroll: true })
    }
  }

  function selectEntry(
    entryId: string,
    opts: { scrollList?: boolean; focusRow?: boolean; focusScan?: boolean } = {},
  ) {
    selectedId = entryId
    const url = new URL(window.location.href)
    url.searchParams.set('entry', entryId)
    try {
      replaceState(url, {})
    } catch {
      // Ignore if router state isn't initialized during hydration
    }
    if (opts.scrollList || opts.focusRow) scrollRowIntoView(entryId, opts.focusRow)
    if (opts.focusScan) {
      const item = items.find((i) => i.entry.id === entryId)
      if (item) focusEntryOnScan(item)
    }
  }

  function moveSelection(delta: number, moveFocus: boolean) {
    if (items.length === 0) return
    const currentIdx = selectedId ? items.findIndex((i) => i.entry.id === selectedId) : -1
    const nextIdx =
      currentIdx < 0
        ? delta > 0
          ? 0
          : items.length - 1
        : Math.max(0, Math.min(items.length - 1, currentIdx + delta))
    selectEntry(items[nextIdx].entry.id, { scrollList: true, focusRow: moveFocus })
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    if (event.key === 'PageUp' && data.prevSeq !== null) {
      event.preventDefault()
      void goto(pageHref(data.prevSeq))
    } else if (event.key === 'PageDown' && data.nextSeq !== null) {
      event.preventDefault()
      void goto(pageHref(data.nextSeq))
    } else if (event.key === 'Escape' && selectedId) {
      selectedId = null
      const url = new URL(window.location.href)
      url.searchParams.delete('entry')
      try {
        replaceState(url, {})
      } catch {
        // ignore
      }
    } else if (zoom <= 1 && items.length > 0) {
      const inHeaderOrMenu = Boolean(target?.closest('header, nav, [popover]'))
      if (inHeaderOrMenu) return
      const inReaderControl = Boolean(target?.closest('.entry-list, .scan-pane'))
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        moveSelection(1, inReaderControl)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        moveSelection(-1, inReaderControl)
      }
    }
  }

  $effect(() => {
    const init = data.initialEntry
    hoveredId = null
    if (init && items.some((i) => i.entry.id === init)) {
      selectedId = init
      void tick().then(() => scrollRowIntoView(init))
    } else {
      selectedId = null
    }
  })
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
        bind:zoom
        bind:pan
        bind:image={imageEl}
        bind:frame={frameEl}
        src={pageImageUrl(current.image_key, 1600)}
        srcset={pageSrcset(current.image_key, current.width)}
        sizes="(max-width: 960px) 100vw, 66vw"
        alt={`${scheme.title} · ${current.printed_label}`}
        width={current.width}
        height={current.height}
        loading="eager"
      >
        {#snippet overlay()}
          {#if overlayBoxes.length > 0}
            <div class="overlay-layer" class:is-dimmed={!showBoxes}>
              {#each overlayBoxes as box (box.key)}
                {@const isActive = activeId === box.entryId}
                {@const isSelected = selectedId === box.entryId}
                <button
                  type="button"
                  class="mark-box"
                  class:is-base={box.role === 'base'}
                  class:is-active={isActive}
                  class:is-selected={isSelected}
                  style:left="{box.x * 100}%"
                  style:top="{box.y * 100}%"
                  style:width="{box.w * 100}%"
                  style:height="{box.h * 100}%"
                  aria-label={box.label}
                  aria-pressed={isSelected}
                  onmouseenter={() => (hoveredId = box.entryId)}
                  onmouseleave={() => {
                    if (hoveredId === box.entryId) hoveredId = null
                  }}
                  onfocus={() => (hoveredId = box.entryId)}
                  onblur={() => {
                    if (hoveredId === box.entryId) hoveredId = null
                  }}
                  onclick={() => selectEntry(box.entryId, { scrollList: true })}
                ></button>
              {/each}
            </div>
          {/if}
        {/snippet}
      </ZoomablePicture>

      <div class="scan-foot">
        <div class="scan-foot-left">
          <span class="mono muted">{current.width}×{current.height}</span>
          {#if items.length > 0}
            <button
              type="button"
              class="ga-chip"
              aria-pressed={showBoxes}
              onclick={() => (showBoxes = !showBoxes)}
            >
              {t('book.showBoxes')}
            </button>
          {/if}
        </div>
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
      {#if items.length > 0}
        <section class="ga-card side-card transcription-card">
          <div class="card-head">
            <h2>{t('book.transcription')}</h2>
            <span class="mono muted small">{t('book.entryCount', { n: items.length })}</span>
          </div>

          <div class="entry-list" bind:this={listEl}>
            {#each sections as group (group.items[0].entry.id)}
              <div class="entry-section">
                {#if sections.length > 1 || group.section}
                  <h3 class="sec-heading" {lang}>{sectionLabel(group.section)}</h3>
                {/if}
                <ol class="pair-list">
                  {#each group.items as item (item.entry.id)}
                    {@const isActive = activeId === item.entry.id}
                    {@const isSelected = selectedId === item.entry.id}
                    <li
                      class="pair-item"
                      class:is-active={isActive}
                      class:is-selected={isSelected}
                      data-entry-id={item.entry.id}
                    >
                      <div class="pair-main">
                        <button
                          type="button"
                          class="pair-btn"
                          aria-pressed={isSelected}
                          onmouseenter={() => (hoveredId = item.entry.id)}
                          onmouseleave={() => {
                            if (hoveredId === item.entry.id) hoveredId = null
                          }}
                          onfocus={() => (hoveredId = item.entry.id)}
                          onblur={() => {
                            if (hoveredId === item.entry.id) hoveredId = null
                          }}
                          onclick={() => selectEntry(item.entry.id, { focusScan: true })}
                        >
                          <span class="bases">
                            {#each item.bases as b, bi (b.formId + '#' + bi)}
                              <span class="han-glyph" lang={b.lang || lang}>
                                {#if b.rendered.isEncoded}
                                  {b.rendered.text}
                                {:else if b.rendered.ids}
                                  <span class="ids-text">{b.rendered.ids}</span>
                                {:else}
                                  <span class="photo-tag">{t('book.unencoded')}</span>
                                {/if}
                              </span>{#if bi < item.bases.length - 1}<span class="sep">·</span>{/if}
                            {/each}
                          </span>
                          <span class="arrow" aria-hidden="true">→</span>
                          <span class="form-val" {lang}>
                            {#if item.formRendered.isEncoded}
                              <span class="han-glyph is-form">{item.formRendered.text}</span>
                            {:else if item.formRendered.ids}
                              <span class="ids-text">{item.formRendered.ids}</span>
                            {:else}
                              <span class="photo-tag">{t('book.unencoded')}</span>
                            {/if}
                          </span>
                          {#if item.entry.kind === 'word'}
                            <span class="mini-tag">{t('book.kind.word')}</span>
                          {:else if item.entry.kind === 'component'}
                            <span class="mini-tag">{t('book.kind.component')}</span>
                          {/if}
                        </button>
                      </div>

                      {#if item.entry.condition || item.entry.footnote}
                        <div class="pair-notes" {lang}>
                          {#if item.entry.condition}
                            <span class="cond-pill">{item.entry.condition}</span>
                          {/if}
                          {#if item.entry.footnote}
                            <p class="footnote-text">{item.entry.footnote}</p>
                          {/if}
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ol>
              </div>
            {/each}
          </div>
        </section>
      {:else}
        <section class="ga-card side-card">
          <h2 {lang}>{scheme.title}</h2>
          <p class="muted small" {lang}>{edition.imprint || edition.title}</p>
          <p class="muted small">{t('book.noEntries')}</p>
          <dl class="facts">
            <div><dt>{t('book.pageLabel')}</dt><dd>{current.printed_label}</dd></div>
            <div><dt>{t('book.sequence')}</dt><dd class="mono">{current.seq} / {data.pages.length}</dd></div>
            <div><dt>{t('book.edition')}</dt><dd class="mono">{edition.id}</dd></div>
          </dl>
        </section>
      {/if}

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
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 20px;
    align-items: start;
  }

  .scan-pane {
    display: grid;
    gap: 8px;
    min-inline-size: 0;
  }

  .overlay-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .mark-box {
    position: absolute;
    box-sizing: border-box;
    min-inline-size: 0;
    min-block-size: 0;
    padding: 0;
    margin: 0;
    background: transparent;
    border: calc(1.25px * var(--inv, 1)) solid color-mix(in srgb, var(--mark) 34%, transparent);
    border-radius: calc(2px * var(--inv, 1));
    pointer-events: auto;
    cursor: pointer;
    transition: border-color 80ms ease, background-color 80ms ease;
  }

  .mark-box.is-base {
    border-color: color-mix(in srgb, var(--tag-language-ink) 28%, transparent);
  }

  .overlay-layer.is-dimmed .mark-box:not(.is-active):not(.is-selected) {
    border-color: transparent;
  }

  .mark-box:focus-visible {
    outline: calc(2px * var(--inv, 1)) solid var(--focus-ring);
    outline-offset: calc(1px * var(--inv, 1));
    z-index: 4;
  }

  .mark-box.is-active,
  .mark-box.is-selected {
    border-width: calc(2px * var(--inv, 1));
    border-color: var(--mark);
    background: color-mix(in srgb, var(--mark) 10%, transparent);
    z-index: 3;
  }

  .mark-box.is-base.is-active,
  .mark-box.is-base.is-selected {
    border-color: var(--tag-language-ink);
    border-style: dashed;
    background: color-mix(in srgb, var(--tag-language-ink) 8%, transparent);
  }

  .scan-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  .scan-foot-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .scan-foot .ga-chip {
    min-block-size: 28px;
    padding: 3px 10px;
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

  .transcription-card {
    padding: 0;
    gap: 0;
    overflow: hidden;
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-block-end: 1px solid var(--line);
    background: var(--surface);
  }

  .card-head h2,
  .side-card h2 {
    font-size: 15px;
    font-weight: 600;
  }

  .side-card h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }

  .entry-list {
    max-block-size: min(62vh, 620px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .sec-heading {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    margin: 0;
    padding: 7px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface-sunken);
    border-block-end: 1px solid var(--line);
  }

  .pair-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .pair-item {
    border-block-end: 1px solid var(--line);
  }

  .pair-item:last-child {
    border-block-end: 0;
  }

  .pair-item.is-active {
    background: var(--accent-light);
  }

  .pair-item.is-selected {
    background: color-mix(in srgb, var(--mark) 9%, var(--surface));
    box-shadow: inset 3px 0 0 var(--mark);
  }

  .pair-btn {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 8px;
    inline-size: 100%;
    padding: 8px 16px;
    border: 0;
    background: transparent;
    color: var(--ink);
    text-align: start;
    cursor: pointer;
    font: inherit;
  }

  .pair-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .bases {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px;
  }

  .han-glyph {
    font-size: 18px;
    line-height: 1.3;
  }

  .han-glyph.is-form {
    font-weight: 600;
  }

  .sep {
    color: var(--muted);
    font-size: 12px;
    margin-inline: 1px;
  }

  .arrow {
    color: var(--muted);
    font-size: 13px;
  }

  .ids-text {
    font-size: 14px;
    color: var(--ink);
  }

  .photo-tag {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12px;
    color: var(--muted);
    background: var(--surface-sunken);
  }

  .mini-tag {
    margin-inline-start: auto;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 12px;
    color: var(--muted);
    background: var(--surface-sunken);
  }

  .pair-notes {
    padding: 0 16px 8px;
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }

  .cond-pill {
    display: inline-block;
    justify-self: start;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--surface-sunken);
    color: var(--ink);
    font-size: 12px;
  }

  .footnote-text {
    margin: 0;
    line-height: 1.45;
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

    .entry-list {
      max-block-size: 360px;
    }

    .strip {
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    }
  }
</style>
