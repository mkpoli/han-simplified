<script lang="ts">
  import { onMount } from 'svelte'
  import Mark from '$lib/components/Mark.svelte'
  import manifest from '$lib/design/manifest.json'
  import { parseTheme, setTheme, type Theme } from '$lib/theme'

  let scheme = $state<Theme>('system')

  onMount(() => {
    const read = () => {
      scheme = parseTheme(document.documentElement.dataset.theme)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  })

  function choose(value: Theme) {
    setTheme(value)
    scheme = value
  }

  const surfaceTokens = [
    'paper',
    'surface',
    'surface-sunken',
    'surface-subtle',
    'surface-tile',
    'surface-selected',
    'surface-badge',
    'surface-quiet',
    'scan-paper',
  ]
  const inkTokens = ['ink', 'muted', 'faint', 'ink-soft']
  const lineTokens = ['line', 'line-strong', 'line-hover']
  const accentTokens = ['accent', 'accent-solid', 'accent-solid-hover', 'accent-light', 'accent-tile', 'focus-ring']
  const statusTokens = ['good', 'wrong', 'uncertain', 'proposed', 'mark', 'action-surface']

  const linkPalette = [
    { source: "Left scheme's own table", token: 'tag-language-ink', bg: 'tag-language-bg' },
    { source: "Right scheme's own table", token: 'tag-form-ink', bg: 'tag-form-bg' },
    { source: 'Official variant or standard table', token: 'tag-domain-ink', bg: 'tag-domain-bg' },
    { source: 'Unihan alone', token: 'tag-meta-ink', bg: 'tag-meta-bg' },
    { source: "Editor's link", token: 'tag-region-ink', bg: 'tag-region-bg' },
    { source: 'Same character', token: 'ink', bg: 'surface-sunken' },
  ]

  const typeScale = [
    { token: '--ga-text-3xl', size: '34px', use: 'Page title' },
    { token: '--ga-text-2xl', size: '25px', use: 'Section title' },
    { token: '--ga-text-xl', size: '17px', use: 'Card & wordmark title' },
    { token: '--ga-text-lg', size: '14px', use: 'Body & controls (floor 12px)' },
    { token: '--ga-text-md', size: '12px', use: 'Badges, captions, meta' },
  ]

  const spaceScale = [
    ['1', '4px'],
    ['2', '8px'],
    ['3', '12px'],
    ['4', '16px'],
    ['5', '20px'],
    ['6', '24px'],
    ['7', '32px'],
    ['8', '40px'],
    ['9', '48px'],
  ]
  const radiusScale = ['xs', 'sm', 'md', 'lg', 'xl', 'full']

  const syncedFiles = Object.keys(manifest.files)
</script>

<svelte:head>
  <title>Design system · Simplified Han Compared · Glyph Atlas</title>
  <meta name="description" content="Pinned Glyph Atlas tokens and controls for Simplified Han Compared." />
</svelte:head>

{#snippet tick()}
  <svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1.8 6.4 4.6 9 10.2 2.8" />
  </svg>
{/snippet}

<div class="design" lang="en">
  <header class="hero">
    <p class="overline">Glyph Atlas · Simplified Han Compared</p>
    <div class="hero-title">
      <h1>Design system</h1>
      <div class="scheme" role="group" aria-label="Colour scheme">
        {#each ['system', 'light', 'dark'] as Theme[] as value (value)}
          <button type="button" class="ga-tab" aria-pressed={scheme === value} onclick={() => choose(value)}>
            {value}
          </button>
        {/each}
      </div>
    </div>
    <p class="hero-copy">
      Pinned colour pairs, type scale, spacing and controls from Glyph Atlas, with Compendium overrides for Simplified Han Compared.
    </p>
    <div class="hero-meta">
      <span class="ga-badge ga-badge--live"><span class="ga-badge__dot"></span>Pinned tokens</span>
      <code>{manifest.repository}@{manifest.commit.slice(0, 12)}</code>
      <span>{syncedFiles.join(' · ')}</span>
    </div>
  </header>

  <nav class="toc" aria-label="Design system sections">
    <div>
      <span>Foundations</span>
      <a href="#colour">Colour</a>
      <a href="#links">Link palette</a>
      <a href="#type">Type</a>
      <a href="#space">Space</a>
    </div>
    <div>
      <span>Components</span>
      <a href="#buttons">Buttons</a>
      <a href="#fields">Fields</a>
      <a href="#choice">Choice</a>
      <a href="#status">Status</a>
      <a href="#surfaces">Surfaces</a>
    </div>
    <div>
      <span>Patterns</span>
      <a href="#toolbar">Toolbar</a>
      <a href="#record">Scan cell</a>
      <a href="#empty">Empty</a>
    </div>
  </nav>

  <section id="colour" class="section">
    <header class="section-head">
      <p class="overline">Foundations</p>
      <h2>Colour</h2>
      <p>Every token resolves in both schemes via <code>light-dark()</code>. Book scans stay on <code>--scan-paper</code> unchanged in dark mode.</p>
    </header>
    <div class="groups">
      <div class="group">
        <h3>Surfaces</h3>
        <div class="swatches">
          {#each surfaceTokens as token (token)}
            <div class="swatch"><span style={`background:var(--${token})`}></span><code>{token}</code></div>
          {/each}
        </div>
      </div>
      <div class="group">
        <h3>Ink</h3>
        <div class="swatches">
          {#each inkTokens as token (token)}
            <div class="swatch"><span style={`background:var(--${token})`}></span><code>{token}</code></div>
          {/each}
        </div>
      </div>
      <div class="group">
        <h3>Lines</h3>
        <div class="swatches">
          {#each lineTokens as token (token)}
            <div class="swatch"><span style={`background:var(--${token})`}></span><code>{token}</code></div>
          {/each}
        </div>
      </div>
      <div class="group">
        <h3>Accent</h3>
        <div class="swatches">
          {#each accentTokens as token (token)}
            <div class="swatch"><span style={`background:var(--${token})`}></span><code>{token}</code></div>
          {/each}
        </div>
      </div>
      <div class="group">
        <h3>Status &amp; marks</h3>
        <div class="swatches">
          {#each statusTokens as token (token)}
            <div class="swatch"><span style={`background:var(--${token})`}></span><code>{token}</code></div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section id="links" class="section">
    <header class="section-head">
      <p class="overline">Foundations</p>
      <h2>Link palette (譜)</h2>
      <p>Line colour names the source of each join between schemes; solid lines are regular, dashed lines are limited to a sense.</p>
    </header>
    <div class="link-grid">
      {#each linkPalette as item (item.token)}
        <div class="link-row">
          <svg viewBox="0 0 84 24" width="84" height="24" aria-hidden="true">
            <line x1="4" y1="8" x2="80" y2="8" stroke={`var(--${item.token})`} stroke-width="2.5" stroke-linecap="round" />
            <line x1="4" y1="18" x2="80" y2="18" stroke={`var(--${item.token})`} stroke-width="2.5" stroke-dasharray="5 4" stroke-linecap="round" />
          </svg>
          <div class="link-meta">
            <span>{item.source}</span>
            <code>--{item.token}</code>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section id="type" class="section">
    <header class="section-head">
      <p class="overline">Foundations</p>
      <h2>Type &amp; Han scripts</h2>
      <p>Body text is 14 px with a 12 px floor. Han forms set explicit <code>lang</code> attributes so each scheme uses its regional CJK stack.</p>
    </header>
    <div class="spec">
      {#each typeScale as row (row.token)}
        <div class="type-row">
          <code>{row.token} · {row.size}</code>
          <span style={`font-size:var(${row.token});font-weight:${row.size === '34px' || row.size === '25px' ? 500 : 400}`}>
            簡化字譜 · Simplified Han Compared
          </span>
          <small>{row.use}</small>
        </div>
      {/each}
    </div>
    <div class="lang-samples">
      <div class="ga-card" lang="zh-Hant">
        <p class="ga-card__meta"><code>lang="zh-Hant"</code> · 1935</p>
        <p class="han-sample">發 髮 骨 藏 鹽</p>
      </div>
      <div class="ga-card" lang="zh-Hans">
        <p class="ga-card__meta"><code>lang="zh-Hans"</code> · 1964 / 1977</p>
        <p class="han-sample">发 懒 缆 藏 盐</p>
      </div>
      <div class="ga-card" lang="ja">
        <p class="ga-card__meta"><code>lang="ja"</code> · 1949</p>
        <p class="han-sample">発 髪 骨 蔵 塩</p>
      </div>
      <div class="ga-card" lang="ko">
        <p class="ga-card__meta"><code>lang="ko"</code> · 1967</p>
        <p class="han-sample">發 髮 骨 藏 鹽</p>
      </div>
    </div>
  </section>

  <section id="space" class="section">
    <header class="section-head">
      <p class="overline">Foundations</p>
      <h2>Space, radius &amp; mark</h2>
      <p>A 4 px step for gaps and padding; controls use 6–7 px radius, cards 10 px. The mark reduces the fourth square to three strokes.</p>
    </header>
    <div class="split">
      <div class="spec">
        {#each spaceScale as [step, size] (step)}
          <div class="space-row"><code>--ga-space-{step}</code><span style={`width:var(--ga-space-${step})`}></span><small>{size}</small></div>
        {/each}
      </div>
      <div class="spec">
        {#each radiusScale as radius (radius)}
          <div class="radius-row"><code>--ga-radius-{radius}</code><span style={`border-radius:var(--ga-radius-${radius})`}></span></div>
        {/each}
        <div class="mark-demo">
          <Mark size={16} />
          <Mark size={26} />
          <Mark size={40} />
          <code>16px · 26px · 40px</code>
        </div>
      </div>
    </div>
  </section>

  <section id="buttons" class="section">
    <header class="section-head">
      <p class="overline">Components</p>
      <h2>Buttons</h2>
      <p>Primary actions sit on <code>--action-surface</code> matching the Compendium. Secondary controls use surface buttons or quiet links.</p>
    </header>
    <div class="demo">
      <div class="demo-row">
        <button type="button" class="ga-button ga-button--primary">Compare schemes <span aria-hidden="true">→</span></button>
        <button type="button" class="ga-button">Photo</button>
        <button type="button" class="ga-button ga-button--quiet">Reset filters</button>
        <button type="button" class="ga-button ga-button--icon" aria-label="More">···</button>
        <button type="button" class="ga-button" disabled>Disabled</button>
      </div>
    </div>
  </section>

  <section id="fields" class="section">
    <header class="section-head">
      <p class="overline">Components</p>
      <h2>Fields</h2>
      <p>Labels stay visible above controls; invalid state pairs border and message.</p>
    </header>
    <div class="demo grid">
      <label class="ga-field">
        <span class="ga-label">Search character, IDS or reading</span>
        <input class="ga-input" placeholder="藏 or 艹上 or cáng" />
        <span class="ga-hint">Matches bases, given forms, components and Unihan readings.</span>
      </label>
      <label class="ga-field">
        <span class="ga-label">Invalid input</span>
        <input class="ga-input" aria-invalid="true" value="U+E001" aria-describedby="pua-error" />
        <span class="ga-error" id="pua-error">Private-use code points are forbidden in data and addresses.</span>
      </label>
      <label class="ga-field">
        <span class="ga-label">Disabled</span>
        <input class="ga-input" value="Read-only in 1.0" disabled />
      </label>
    </div>
  </section>

  <section id="choice" class="section">
    <header class="section-head">
      <p class="overline">Components</p>
      <h2>Choice</h2>
      <p>Filter pills embed a checkbox so active filters remain distinct without relying on colour alone.</p>
    </header>
    <div class="demo">
      <div class="demo-row">
        <label class="ga-choice"><input type="checkbox" checked /> Show editor additions</label>
        <label class="ga-choice"><input type="checkbox" /> Drafts only</label>
        <label class="ga-choice"><input type="radio" name="view-mode" checked /> Photo</label>
        <label class="ga-choice"><input type="radio" name="view-mode" /> Type</label>
        <label class="ga-choice"><input type="radio" name="view-mode" /> Both</label>
      </div>
      <div class="demo-row wrap">
        <label class="ga-pill"><input type="checkbox" checked /><span class="ga-pill__box">{@render tick()}</span>China 1935</label>
        <label class="ga-pill"><input type="checkbox" checked /><span class="ga-pill__box">{@render tick()}</span>China 1964</label>
        <label class="ga-pill"><input type="checkbox" checked /><span class="ga-pill__box">{@render tick()}</span>China 1977 (draft)</label>
        <label class="ga-pill"><input type="checkbox" /><span class="ga-pill__box">{@render tick()}</span>Japan 1949</label>
        <label class="ga-pill"><input type="checkbox" disabled /><span class="ga-pill__box">{@render tick()}</span>Malaysia 1981</label>
      </div>
    </div>
  </section>

  <section id="status" class="section">
    <header class="section-head">
      <p class="overline">Components</p>
      <h2>Status</h2>
      <p>Scheme states carry both a word and a surface: <code>checked</code>, <code>transcribed</code>, and <code>listed</code>.</p>
    </header>
    <div class="demo">
      <div class="demo-row">
        <span class="ga-badge ga-badge--checked">✓ Checked</span>
        <span class="ga-badge ga-badge--transcribed">Transcribed</span>
        <span class="ga-badge ga-badge--listed">Listed</span>
        <span class="ga-badge ga-badge--live"><span class="ga-badge__dot"></span>Adopted</span>
        <span class="ga-badge ga-badge--wrong">Withdrawn</span>
      </div>
    </div>
  </section>

  <section id="surfaces" class="section">
    <header class="section-head">
      <p class="overline">Components</p>
      <h2>Surfaces</h2>
      <p>Tabs, cards and menus share one border, radius and surface token.</p>
    </header>
    <div class="demo">
      <div class="demo-row">
        <div class="ga-tabs" role="tablist" aria-label="Filter tabs example">
          <button type="button" role="tab" class="ga-tab" aria-selected="true">All</button>
          <button type="button" role="tab" class="ga-tab" aria-selected="false">Differs</button>
          <button type="button" role="tab" class="ga-tab" aria-selected="false">Merged</button>
          <button type="button" role="tab" class="ga-tab" aria-selected="false">Unencoded</button>
        </div>
      </div>
      <div class="demo-row align-start">
        <article class="ga-card">
          <h3 class="ga-card__title" lang="zh-Hans">第二次汉字简化方案（草案）</h3>
          <p class="ga-card__meta">cn-1977 · 1977 · withdrawn · checked</p>
        </article>
        <div class="ga-menu">
          <span class="ga-menu__label">Columns</span>
          <button type="button" class="ga-menu__item">China</button>
          <button type="button" class="ga-menu__item">Japan</button>
          <button type="button" class="ga-menu__item">China and Japan</button>
        </div>
      </div>
    </div>
  </section>

  <section id="toolbar" class="section">
    <header class="section-head">
      <p class="overline">Patterns</p>
      <h2>Toolbar</h2>
      <p>Search first, column preset and view mode beside it, sitting on a rule above the comparison table.</p>
    </header>
    <div class="demo">
      <div class="ga-toolbar">
        <input class="ga-input search" placeholder="藏 or 艹上 or cáng" aria-label="Search comparison table" />
        <div class="ga-tabs" role="group" aria-label="Display mode">
          <button type="button" class="ga-tab" aria-pressed="true">Photo</button>
          <button type="button" class="ga-tab" aria-pressed="false">Type</button>
          <button type="button" class="ga-tab" aria-pressed="false">Both</button>
        </div>
        <button type="button" class="ga-button ga-button--quiet">Reset</button>
      </div>
    </div>
  </section>

  <section id="record" class="section">
    <header class="section-head">
      <p class="overline">Patterns</p>
      <h2>Scan cell &amp; bounding mark</h2>
      <p>Photographed glyphs sit on <code>--scan-paper</code> unchanged in dark mode; the bounding box uses <code>--mark</code> outside the ink.</p>
    </header>
    <div class="record">
      <div class="scan-frame specimen-scan" aria-label="Printed glyph specimen on white scan paper with red bounding box">
        <span class="specimen-glyph" lang="zh-Hans">发</span>
        <span class="scan-box specimen-box" aria-hidden="true"></span>
      </div>
      <div class="record-body">
        <div class="record-line">
          <h3 lang="zh-Hant">發 → <span lang="zh-Hans">发</span></h3>
          <span class="ga-badge ga-badge--checked">✓ Checked</span>
        </div>
        <p class="record-note">cn-1964 · Table 1 · p. 10 · merges with 髮</p>
        <div class="demo-row">
          <span class="cell-state"><code>=</code> listed unchanged (inventory)</span>
          <span class="cell-state"><code>·</code> not listed</span>
        </div>
      </div>
    </div>
  </section>

  <section id="empty" class="section">
    <header class="section-head">
      <p class="overline">Patterns</p>
      <h2>Empty state</h2>
    </header>
    <div class="ga-empty">
      <span class="ga-empty__mark" aria-hidden="true">·</span>
      <h3 class="ga-empty__title">No matching characters</h3>
      <p class="ga-empty__hint">Try a base character, an IDS component, or clear active scheme filters.</p>
      <button type="button" class="ga-button">Clear filters</button>
    </div>
  </section>

  <footer class="design-foot">
    <span>Synced from <code>{manifest.repository}</code> at <code>{manifest.commit.slice(0, 12)}</code></span>
    <span class="mono">{syncedFiles.length} files verified</span>
  </footer>
</div>

<style>
  .design {
    max-inline-size: 1120px;
    margin-inline: auto;
    padding: 36px var(--page-gutter) 84px;
  }

  .overline {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero {
    display: grid;
    gap: 14px;
    padding-block-end: 28px;
  }

  .hero-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .hero h1 {
    font-size: var(--ga-text-3xl);
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  .hero-copy {
    max-inline-size: 66ch;
    color: var(--muted);
    font-size: 14px;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    color: var(--muted);
    font-size: 12px;
  }

  .hero-meta code,
  .section-head code,
  .design-foot code {
    font-family: var(--ga-font-mono);
    color: var(--ink);
  }

  .scheme {
    display: flex;
    gap: 4px;
  }

  .toc {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    gap: 14px 24px;
    padding: 12px 0;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(8px);
    border-block: 1px solid var(--line);
  }

  .toc div {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }

  .toc span {
    color: var(--faint);
    font-family: var(--ga-font-mono);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .toc a {
    color: var(--muted);
    font-size: 13px;
  }

  .toc a:hover {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .section {
    display: grid;
    gap: 24px;
    padding: 42px 0;
    border-block-end: 1px solid var(--line);
    scroll-margin-top: 64px;
  }

  .section-head {
    display: grid;
    gap: 8px;
    max-inline-size: 70ch;
  }

  .section-head h2 {
    font-size: var(--ga-text-2xl);
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .section-head p {
    color: var(--muted);
    font-size: 14px;
  }

  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
  }

  .group h3 {
    margin-block-end: 10px;
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 10px;
  }

  .swatch {
    display: grid;
    gap: 6px;
  }

  .swatch span {
    display: block;
    block-size: 48px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-sm);
  }

  .swatch code {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .link-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
  }

  .link-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--surface);
  }

  .link-meta {
    display: grid;
    gap: 2px;
    min-inline-size: 0;
  }

  .link-meta code {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
  }

  .spec {
    display: grid;
    gap: 2px;
  }

  .type-row {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr) 180px;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-block-start: 1px solid var(--line);
  }

  .type-row code,
  .space-row code,
  .radius-row code,
  .mark-demo code {
    color: var(--muted);
    font-family: var(--ga-font-mono);
    font-size: 12px;
  }

  .type-row span {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .type-row small {
    color: var(--muted);
    font-size: 12px;
    text-align: end;
  }

  .lang-samples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .han-sample {
    margin-block-start: 8px;
    font-size: 24px;
    line-height: 1.3;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .space-row {
    display: grid;
    grid-template-columns: 130px auto 48px;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }

  .space-row span {
    display: block;
    block-size: 12px;
    background: var(--accent);
    border-radius: 2px;
  }

  .space-row small {
    color: var(--muted);
    font-size: 12px;
  }

  .radius-row {
    display: grid;
    grid-template-columns: 130px auto;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }

  .radius-row span {
    display: block;
    inline-size: 84px;
    block-size: 40px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
  }

  .mark-demo {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-block-start: 16px;
    padding-block-start: 16px;
    border-block-start: 1px solid var(--line);
  }

  .demo {
    display: grid;
    gap: 16px;
  }

  .demo.grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 18px;
  }

  .demo-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .demo-row.align-start {
    align-items: flex-start;
  }

  .search {
    flex: 1 1 260px;
    max-inline-size: 420px;
  }

  .record {
    display: grid;
    grid-template-columns: 160px minmax(0, 1fr);
    gap: 24px;
    align-items: center;
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-lg);
    background: var(--surface);
  }

  .specimen-scan {
    display: grid;
    place-items: center;
    inline-size: 160px;
    block-size: 160px;
  }

  .specimen-glyph {
    color: #19191c;
    font-family: var(--cjk-serif);
    font-size: 84px;
    line-height: 1;
  }

  .specimen-box {
    inset: 18px;
  }

  .record-body {
    display: grid;
    gap: 10px;
  }

  .record-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .record-line h3 {
    font-size: var(--ga-text-2xl);
    font-weight: 500;
  }

  .record-note {
    color: var(--muted);
    font-size: 14px;
  }

  .cell-state {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-sm);
    background: var(--surface-sunken);
    font-size: 12px;
    color: var(--muted);
  }

  .cell-state code {
    color: var(--ink);
    font-family: var(--ga-font-mono);
    font-weight: 600;
  }

  .design-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-block-start: 28px;
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 760px) {
    .type-row {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .type-row small {
      text-align: start;
    }
    .split,
    .record {
      grid-template-columns: 1fr;
    }
    .toc {
      position: static;
    }
  }
</style>
