export type PageImageSize = 320 | 1600 | 'full'

export function pageImageUrl(imageKey: string, size: PageImageSize = 1600): string {
  const file = size === 'full' ? 'full.webp' : `w${size}.webp`
  return `/media/${imageKey}/${file}`
}

export function pageSrcset(imageKey: string, fullWidth: number): string {
  return `${pageImageUrl(imageKey, 320)} 320w, ${pageImageUrl(imageKey, 1600)} 1600w, ${pageImageUrl(imageKey, 'full')} ${fullWidth}w`
}
