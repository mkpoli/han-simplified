<script lang="ts">
  import type { Snippet } from 'svelte'
  import { t } from '$lib/t'
  import { aroundPoint, clampZoom, confinePan, ZOOM_MAX, ZOOM_STEP, type Pan } from '$lib/zoom'

  let {
    src,
    srcset,
    sizes,
    alt,
    width,
    height,
    loading = 'eager',
    image = $bindable(),
    zoom = $bindable(1),
    frame = $bindable(),
    pan = $bindable<Pan>({ x: 0, y: 0 }),
    overlay,
  }: {
    src: string
    srcset?: string
    sizes?: string
    alt: string
    width?: number
    height?: number
    loading?: 'eager' | 'lazy'
    image?: HTMLImageElement
    zoom?: number
    frame?: HTMLElement
    pan?: Pan
    overlay?: Snippet
  } = $props()

  let drag = $state<{ id: number; x: number; y: number; pan: Pan } | null>(null)

  const pictureSize = () => ({ width: image?.offsetWidth ?? 0, height: image?.offsetHeight ?? 0 })
  const frameSize = () => ({ width: frame?.clientWidth ?? 0, height: frame?.clientHeight ?? 0 })
  const settled = (next: Pan, scale = zoom) => confinePan(next, scale, pictureSize(), frameSize())

  function zoomBy(factor: number, at: Pan = { x: 0, y: 0 }) {
    const next = clampZoom(zoom * factor)
    if (next === zoom) return
    pan = settled(aroundPoint(pan, at, zoom, next), next)
    zoom = next
  }

  export function reset() {
    zoom = 1
    pan = { x: 0, y: 0 }
  }

  function pointAt(event: { clientX: number; clientY: number }): Pan {
    const rect = frame!.getBoundingClientRect()
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    }
  }

  function down(event: PointerEvent) {
    if (event.button !== 0 || (event.target as Element).closest('.tools')) return
    if (zoom <= 1) return
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan }
    frame!.focus({ preventScroll: true })
    frame!.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return
    pan = settled({
      x: drag.pan.x + event.clientX - drag.x,
      y: drag.pan.y + event.clientY - drag.y,
    })
  }

  function up(event: PointerEvent) {
    if (drag?.id === event.pointerId) {
      drag = null
      if (frame?.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId)
    }
  }

  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoomBy(Math.exp(-event.deltaY * 0.002), pointAt(event))
    } else if (zoom > 1) {
      event.preventDefault()
      pan = settled({ x: pan.x - event.deltaX, y: pan.y - event.deltaY })
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(ZOOM_STEP)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(1 / ZOOM_STEP)
    } else if (event.key === '0') {
      event.preventDefault()
      reset()
    } else if (zoom > 1 && event.key.startsWith('Arrow')) {
      event.preventDefault()
      const step = 48
      const dx = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0
      const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
      pan = settled({ x: pan.x + dx, y: pan.y + dy })
    }
  }

  $effect(() => {
    void src
    zoom = 1
    pan = { x: 0, y: 0 }
  })

  $effect(() => {
    if (!frame) return
    const observer = new ResizeObserver(() => {
      if (zoom > 1) pan = settled(pan)
    })
    observer.observe(frame)
    return () => observer.disconnect()
  })
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="zoom"
  bind:this={frame}
  class:panning={zoom > 1}
  class:dragging={Boolean(drag)}
  role="group"
  aria-label={t('book.zoomFrame')}
  tabindex="0"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onkeydown={keydown}
  onwheel={wheel}
>
  <div
    class="plane"
    style:transform="translate({pan.x}px, {pan.y}px) scale({zoom})"
    style:--inv={1 / zoom}
  >
    <img
      bind:this={image}
      {src}
      {srcset}
      {sizes}
      {alt}
      {width}
      {height}
      {loading}
      draggable="false"
    />
    {@render overlay?.()}
  </div>

  <div class="tools">
    <button
      type="button"
      aria-label={t('book.zoomOut')}
      title={t('book.zoomOut')}
      disabled={zoom <= 1}
      onclick={() => zoomBy(1 / ZOOM_STEP)}
    >
      −
    </button>
    <button
      type="button"
      class="fit"
      aria-label={t('book.zoomFit')}
      title={t('book.zoomFit')}
      disabled={zoom <= 1}
      onclick={reset}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M9 9h6v6H9z" />
      </svg>
    </button>
    <button
      type="button"
      aria-label={t('book.zoomIn')}
      title={t('book.zoomIn')}
      disabled={zoom >= ZOOM_MAX}
      onclick={() => zoomBy(ZOOM_STEP)}
    >
      +
    </button>
  </div>
</div>

<style>
  .zoom {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    max-inline-size: 100%;
    min-block-size: 280px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--ga-radius-md);
    background: var(--surface-sunken);
    touch-action: pan-y;
    user-select: none;
  }

  .zoom.panning {
    cursor: grab;
    touch-action: none;
  }

  .zoom.dragging {
    cursor: grabbing;
  }

  .zoom:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .plane {
    position: relative;
    display: inline-block;
    max-inline-size: 100%;
    line-height: 0;
    background: var(--scan-paper);
    transform-origin: center center;
    will-change: transform;
  }

  .plane img {
    display: block;
    inline-size: auto;
    block-size: auto;
    max-inline-size: 100%;
    max-block-size: var(--picture-height, 78vh);
    pointer-events: none;
    -webkit-user-drag: none;
  }

  @supports (height: 1dvh) {
    .plane img {
      max-block-size: var(--picture-height, 78dvh);
    }
  }

  .tools {
    position: absolute;
    inset-inline-end: 10px;
    inset-block-end: 10px;
    z-index: 2;
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: light-dark(rgb(255 255 255 / 94%), rgb(27 27 31 / 94%));
    box-shadow: 0 2px 12px light-dark(rgb(0 0 0 / 12%), rgb(0 0 0 / 40%));
    cursor: default;
  }

  .tools button {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 32px;
    min-block-size: 32px;
    block-size: 32px;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .tools button:hover:enabled {
    background: var(--accent-light);
  }

  .tools button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .tools .fit {
    inline-size: 34px;
  }

  .tools svg {
    inline-size: 18px;
    block-size: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
</style>
