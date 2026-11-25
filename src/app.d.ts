import type { Locale } from '$lib/i18n'
import type { Theme } from '$lib/theme'

declare global {
  namespace App {
    interface Locals {
      theme: Theme
      locale: Locale
    }

    interface Platform {
      env: {
        MEDIA?: R2Bucket
      }
      context: ExecutionContext
      caches: CacheStorage & { default: Cache }
    }
  }
}

export {}
