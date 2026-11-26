import rawSchemes from '$lib/generated/schemes.json'
import {
  COUNTRIES,
  SCHEME_STATES,
  type Country,
  type SchemeRow,
  type SchemeState,
} from './schema'

export const SCHEMES: readonly SchemeRow[] = rawSchemes as SchemeRow[]

export const SCHEME_BY_ID: ReadonlyMap<string, SchemeRow> = new Map(
  SCHEMES.map((scheme) => [scheme.id, scheme]),
)

export const REPLACED_BY: ReadonlyMap<string, readonly SchemeRow[]> = (() => {
  const map = new Map<string, SchemeRow[]>()
  for (const scheme of SCHEMES) {
    for (const target of scheme.replaces) {
      const list = map.get(target) ?? []
      list.push(scheme)
      map.set(target, list)
    }
  }
  return map
})()

export function isCountry(value: string | null | undefined): value is Country {
  return (COUNTRIES as readonly string[]).includes(value ?? '')
}

export function isSchemeState(value: string | null | undefined): value is SchemeState {
  return (SCHEME_STATES as readonly string[]).includes(value ?? '')
}

export function filterSchemes(
  schemes: readonly SchemeRow[],
  options: { country?: Country | null; state?: SchemeState | null },
): SchemeRow[] {
  return schemes.filter((s) => {
    if (options.country && s.country !== options.country) return false
    if (options.state && s.state !== options.state) return false
    return true
  })
}

export function groupSchemesByCountry(
  schemes: readonly SchemeRow[],
): Array<{ country: Country; schemes: SchemeRow[] }> {
  const groups: Array<{ country: Country; schemes: SchemeRow[] }> = []
  for (const country of COUNTRIES) {
    const items = schemes.filter((s) => s.country === country)
    if (items.length > 0) {
      groups.push({ country, schemes: items })
    }
  }
  return groups
}
