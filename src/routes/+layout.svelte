<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import Mark from '$lib/components/Mark.svelte'
  import { isLocale, LOCALES, LOCALE_COOKIE, LOCALE_NAMES, translate, type Locale } from '$lib/i18n'
  import {
    applyThemeToDocument,
    parseTheme,
    readStoredTheme,
    setTheme,
    THEME_STORAGE_KEY,
    type Theme,
  } from '$lib/theme'

  let { data, children } = $props()

  const activeLocale = $derived<Locale>(isLocale(page.params.locale) ? page.params.locale : data.locale)
  const isDesignPage = $derived(page.url.pathname === '/design' || page.url.pathname.startsWith('/design/'))
  const subpath = $derived(isDesignPage ? '' : page.url.pathname.replace(/^\/[^/]+/, ''))
  const section = $derived(
    isDesignPage
      ? 'design'
      : subpath.startsWith('/compare')
        ? 'graph'
        : subpath.startsWith('/scheme')
          ? 'schemes'
          : subpath.startsWith('/sources')
            ? 'sources'
            : subpath.startsWith('/data')
              ? 'data'
              : subpath === '' || subpath === '/' || subpath.startsWith('/char/') || subpath.startsWith('/form/')
                ? 'table'
                : '',
  )

  const t = (key: string) => translate(activeLocale, key)
  const to = (path = '') => `/${activeLocale}${path}`

  let headerEl = $state<HTMLElement>()
  let innerEl = $state<HTMLDivElement>()
  let navMenuEl = $state<HTMLUListElement>()
  let moreMenuEl = $state<HTMLDivElement>()
  let isWide = $state(false)
  let isMeasuring = $state(false)
  let currentTheme = $state<Theme>('system')

  $effect(() => {
    currentTheme = data.theme
  })

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = isDesignPage ? 'en' : activeLocale
    }
  })

  function isPopoverOpen(el: HTMLElement | undefined): boolean {
    if (!el || !el.hasAttribute('popover')) return false
    if (el.classList.contains(':popover-open')) return true
    try {
      return el.matches(':popover-open')
    } catch {
      return false
    }
  }

  function closePopover(el: HTMLElement | undefined) {
    if (!isPopoverOpen(el)) return
    el?.hidePopover?.()
  }

  function rememberLocale(tag: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${tag}; path=/; max-age=31536000; samesite=lax`
    closePopover(moreMenuEl)
  }

  function chooseTheme(next: Theme) {
    setTheme(next)
    currentTheme = next
    closePopover(moreMenuEl)
  }

  function localeHref(tag: Locale): string {
    if (isDesignPage) return `/${tag}`
    return `/${tag}${subpath}${page.url.search}`
  }

  onMount(() => {
    if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
      void import('@oddbird/popover-polyfill')
    }

    const stored = readStoredTheme()
    if (stored) {
      currentTheme = stored
      applyThemeToDocument(stored)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
      const next = parseTheme(event.newValue)
      currentTheme = next
      applyThemeToDocument(next)
    }
    window.addEventListener('storage', onStorage)

    const themeObserver = new MutationObserver(() => {
      currentTheme = parseTheme(document.documentElement.dataset.theme)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    let lastMeasuredWidth = 0
    let rafId = 0

    function syncLayout(force = false) {
      if (!headerEl || !innerEl || !navMenuEl) return
      const currentWidth = headerEl.clientWidth
      if (!force && !isWide && currentWidth <= lastMeasuredWidth) return
      lastMeasuredWidth = currentWidth

      const wasOpen = isPopoverOpen(navMenuEl)

      isMeasuring = true
      headerEl.classList.add('is-measuring', 'is-wide')
      navMenuEl.removeAttribute('popover')

      const fits = innerEl.scrollWidth <= innerEl.clientWidth + 1

      isWide = fits
      headerEl.classList.toggle('is-wide', fits)
      if (fits) {
        navMenuEl.removeAttribute('popover')
      } else {
        navMenuEl.setAttribute('popover', 'auto')
        if (wasOpen) {
          try {
            navMenuEl.showPopover?.()
          } catch {
            // Popover may already be open or polyfill still loading.
          }
        }
      }

      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        isMeasuring = false
        headerEl?.classList.remove('is-measuring')
      })
    }

    syncLayout(true)

    const resizeObserver = new ResizeObserver(() => syncLayout(false))
    if (headerEl) resizeObserver.observe(headerEl)
    if (navMenuEl) resizeObserver.observe(navMenuEl)

    const onFonts = () => syncLayout(true)
    document.fonts?.addEventListener('loadingdone', onFonts)
    void document.fonts?.ready.then(onFonts)

    return () => {
      window.removeEventListener('storage', onStorage)
      themeObserver.disconnect()
      resizeObserver.disconnect()
      document.fonts?.removeEventListener('loadingdone', onFonts)
      cancelAnimationFrame(rafId)
    }
  })

  afterNavigate(() => {
    closePopover(navMenuEl)
    closePopover(moreMenuEl)
  })
</script>

<header class="site-header" class:is-wide={isWide} class:is-measuring={isMeasuring} bind:this={headerEl}>
  <div class="header-inner" bind:this={innerEl}>
    <a class="wordmark" href={to()} aria-label={t('app.name')}>
      <Mark size={26} />
      <span class="name">{t('app.name')}</span>
      <small class="by" lang="en">GLYPH <b>ATLAS</b></small>
    </a>

    <nav class="site-nav" aria-label={t('nav.navigation')}>
      <button
        class="menu-button ga-button"
        type="button"
        popovertarget="site-nav-menu"
        popovertargetaction="toggle"
        aria-controls="site-nav-menu"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
        <span class="menu-button-label">{t('nav.navigation')}</span>
      </button>

      <ul id="site-nav-menu" class="site-menu" popover="auto" bind:this={navMenuEl}>
        <li>
          <a href={to()} aria-current={section === 'table' ? 'page' : undefined}>{t('nav.table')}</a>
        </li>
        <li>
          <a href={to('/compare')} aria-current={section === 'graph' ? 'page' : undefined}>{t('nav.graph')}</a>
        </li>
        <li>
          <a href={to('/schemes')} aria-current={section === 'schemes' ? 'page' : undefined}>{t('nav.schemes')}</a>
        </li>
        <li>
          <a href={to('/sources')} aria-current={section === 'sources' ? 'page' : undefined}>{t('nav.sources')}</a>
        </li>
        <li>
          <a href={to('/data')} aria-current={section === 'data' ? 'page' : undefined}>{t('nav.data')}</a>
        </li>
      </ul>
    </nav>

    <div class="actions">
      <button
        class="more-button ga-button"
        type="button"
        popovertarget="site-more-menu"
        popovertargetaction="toggle"
        aria-controls="site-more-menu"
        aria-label={t('nav.menu')}
      >
        <span aria-hidden="true">···</span>
      </button>

      <div id="site-more-menu" class="more-panel" popover="auto" bind:this={moreMenuEl}>
        <div class="panel-group">
          <span class="panel-label">{t('nav.language')}</span>
          {#each LOCALES as tag (tag)}
            <a
              href={localeHref(tag)}
              class="panel-item"
              class:is-current={tag === activeLocale}
              lang={tag}
              data-sveltekit-reload
              onclick={() => rememberLocale(tag)}
            >
              <span>{LOCALE_NAMES[tag]}</span>
              {#if tag === activeLocale}<span class="panel-check" aria-hidden="true">✓</span>{/if}
            </a>
          {/each}
        </div>

        <div class="panel-group">
          <span class="panel-label">{t('nav.theme')}</span>
          <button
            type="button"
            class="panel-item"
            class:is-current={currentTheme === 'system'}
            aria-pressed={currentTheme === 'system'}
            onclick={() => chooseTheme('system')}
          >
            <span class="system-light-label">{t('theme.systemLight')}</span>
            <span class="system-dark-label">{t('theme.systemDark')}</span>
            {#if currentTheme === 'system'}<span class="panel-check" aria-hidden="true">✓</span>{/if}
          </button>
          <button
            type="button"
            class="panel-item"
            class:is-current={currentTheme === 'light'}
            aria-pressed={currentTheme === 'light'}
            onclick={() => chooseTheme('light')}
          >
            <span>{t('theme.light')}</span>
            {#if currentTheme === 'light'}<span class="panel-check" aria-hidden="true">✓</span>{/if}
          </button>
          <button
            type="button"
            class="panel-item"
            class:is-current={currentTheme === 'dark'}
            aria-pressed={currentTheme === 'dark'}
            onclick={() => chooseTheme('dark')}
          >
            <span>{t('theme.dark')}</span>
            {#if currentTheme === 'dark'}<span class="panel-check" aria-hidden="true">✓</span>{/if}
          </button>
        </div>

        <div class="panel-group">
          <a
            href="/design"
            class="panel-item"
            class:is-current={section === 'design'}
            aria-current={section === 'design' ? 'page' : undefined}
          >
            <span>{t('nav.design')}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</header>

<main>{@render children()}</main>

<footer class="site-footer">
  <p>
    <a class="text-link" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener" target="_blank">{t('footer.licence')}</a>
    · {t('footer.images')} · {t('footer.code')}
    · <a class="text-link" href="https://glyphatlas.org/" target="_blank" rel="noopener">Glyph Atlas</a>
    · <a class="text-link" href={to('/data')}>{t('nav.data')}</a>
    · <a class="text-link" href="/design">{t('footer.design')}</a>
    · <a class="text-link" href="https://github.com/mkpoli/han-simplified" target="_blank" rel="noopener">{t('footer.github')}</a>
  </p>
</footer>

<style>
  .site-header {
    border-block-end: 1px solid var(--line);
    background: var(--paper);
  }

  .header-inner {
    display: flex;
    align-items: center;
    gap: 28px;
    min-block-size: 72px;
    padding-block: 12px;
    padding-inline: var(--page-gutter);
  }

  .header-inner > * {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    color: var(--ink);
  }

  .name {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .by {
    padding-inline-start: 10px;
    border-inline-start: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.1em;
    font-weight: 400;
  }

  .by b {
    font-weight: 600;
  }

  .site-nav {
    display: flex;
    align-items: center;
    margin-inline-start: auto;
  }

  .site-header.is-wide .site-nav {
    margin-inline-start: 0;
    align-self: stretch;
    align-items: stretch;
    margin-block: -12px;
  }

  .menu-button {
    anchor-name: --nav-menu-button;
    min-block-size: max(40px, var(--target-size));
    padding-inline: 12px;
    font-size: 14px;
  }

  .site-menu {
    list-style: none;
    margin: 0;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-lg);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 12px 30px var(--shadow-menu);
    position: fixed;
    inset: auto;
    inset-block-start: 4.75rem;
    inset-block-start: anchor(--nav-menu-button bottom);
    inset-inline-end: var(--page-gutter);
    inline-size: min(80dvw, 18rem);
    max-inline-size: calc(100dvw - 2rem);
    block-size: fit-content;
    max-block-size: calc(100dvh - 6rem);
    margin-block-start: 0.5rem;
    overflow: auto;
  }

  .site-menu li {
    margin: 0;
    padding: 0;
  }

  .site-menu a {
    display: flex;
    align-items: center;
    min-block-size: max(40px, var(--target-size));
    padding-block: 8px;
    padding-inline: 12px;
    border-radius: var(--ga-radius-sm);
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
  }

  .site-menu a:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }

  .site-menu a[aria-current="page"] {
    background: var(--surface-selected);
    color: var(--ink);
    font-weight: 550;
  }

  .site-header.is-wide .menu-button {
    display: none;
  }

  .site-header.is-wide .site-menu {
    position: static;
    display: flex;
    align-items: stretch;
    gap: 24px;
    inline-size: auto;
    max-inline-size: none;
    block-size: auto;
    max-block-size: none;
    overflow: visible;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .site-header.is-wide .site-menu::backdrop {
    display: none;
  }

  .site-header.is-wide .site-menu li {
    display: flex;
    align-items: stretch;
  }

  .site-header.is-wide .site-menu a {
    padding-block: 0;
    padding-inline: 0;
    border-radius: 0;
    border-block-end: 2px solid transparent;
    background: transparent;
  }

  .site-header.is-wide .site-menu a:hover {
    background: transparent;
    color: var(--ink);
  }

  .site-header.is-wide .site-menu a[aria-current="page"] {
    background: transparent;
    color: var(--ink);
    border-block-end-color: var(--ink);
    font-weight: 500;
  }

  .site-header.is-measuring * {
    transition: none !important;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .site-header.is-wide .actions {
    margin-inline-start: auto;
  }

  .more-button {
    inline-size: max(40px, var(--target-size));
    min-block-size: max(40px, var(--target-size));
    padding: 0;
    font-size: 18px;
    letter-spacing: 1px;
  }

  .more-panel {
    inline-size: min(240px, calc(100dvw - 2rem));
    max-block-size: calc(100dvh - 6rem);
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-lg);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 12px 30px var(--shadow-menu);
  }

  @supports (position-area: block-end) {
    .more-panel {
      inset: auto;
      margin: 0;
      margin-block-start: 6px;
      position-area: block-end span-inline-start;
      position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
    }
  }

  @supports not (position-area: block-end) {
    .more-panel {
      position: fixed;
      inset-block-start: 4.75rem;
      inset-inline-end: var(--page-gutter);
      inset-inline-start: auto;
      inset-block-end: auto;
      margin: 0;
    }
  }

  .panel-group {
    display: flex;
    flex-direction: column;
    padding-block: 4px;
  }

  .panel-group + .panel-group {
    margin-block-start: 4px;
    padding-block-start: 8px;
    border-block-start: 1px solid var(--line);
  }

  .panel-label {
    padding-block: 2px 4px;
    padding-inline: 10px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .panel-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    inline-size: 100%;
    min-block-size: max(36px, var(--target-size));
    padding-block: 6px;
    padding-inline: 10px;
    border: 0;
    border-radius: var(--ga-radius-sm);
    background: transparent;
    color: var(--ink);
    font-size: 14px;
    text-align: start;
    cursor: pointer;
  }

  .panel-item:hover {
    background: var(--surface-sunken);
  }

  .panel-item.is-current {
    color: var(--accent);
    font-weight: 550;
  }

  .panel-check {
    font-size: 12px;
    flex: none;
  }

  /* Show the resolved OS scheme beside "System" without JS. */
  .system-dark-label {
    display: none;
  }

  @media (prefers-color-scheme: dark) {
    .system-light-label {
      display: none;
    }
    .system-dark-label {
      display: inline;
    }
  }

  main {
    min-block-size: 60vh;
  }

  .site-footer {
    padding-block: 18px 36px;
    padding-inline: var(--page-gutter);
    border-block-start: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 640px) {
    .header-inner {
      gap: 12px;
    }
    .by {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .header-inner {
      gap: 8px;
    }
    .site-header:not(.is-wide):not(.is-measuring) .wordmark {
      flex-shrink: 1;
      min-inline-size: 0;
    }
    .site-header:not(.is-wide):not(.is-measuring) .name {
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu-button {
      inline-size: max(40px, var(--target-size));
      padding-inline: 0;
    }
    .menu-button-label {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  }

  @media (forced-colors: active) {
    .site-header.is-wide .site-menu a[aria-current="page"] {
      border-block-end-color: Highlight;
    }
    .site-menu,
    .more-panel {
      border-color: CanvasText;
    }
  }
</style>
