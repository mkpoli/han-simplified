import type { CheckRow, EntryBaseRow, EntryRow, FormRow, RuleRow, SightingRow } from './schema'

export interface SchemeBundle {
  scheme: string
  entries: EntryRow[]
  bases: Record<string, EntryBaseRow[]>
  sightings: Record<string, SightingRow[]>
  forms: Record<string, FormRow>
  rules: RuleRow[]
  checks: CheckRow[]
}

/** Convert space-separated `U+XXXX` codepoints into their Unicode text string. */
export function codepointToText(codepoint: string): string {
  if (!codepoint) return ''
  return codepoint
    .split(' ')
    .map((part) => {
      const m = part.match(/^U\+([0-9A-F]{4,6})$/)
      return m ? String.fromCodePoint(Number.parseInt(m[1], 16)) : ''
    })
    .join('')
}

export interface RenderedForm {
  text: string
  isEncoded: boolean
  ids: string
}

export function renderForm(form: FormRow | undefined): RenderedForm {
  if (!form) return { text: '', isEncoded: false, ids: '' }
  if (form.codepoint) {
    return {
      text: codepointToText(form.codepoint),
      isEncoded: true,
      ids: form.ids,
    }
  }
  return {
    text: '',
    isEncoded: false,
    ids: form.ids,
  }
}

const SECTION_LABELS: Record<string, string> = {
  'table1-1': '第一表 (1) 不作简化偏旁的简化字',
  'table1-2': '第一表 (2) 可作简化偏旁用的简化字',
  'table1-2-analogical': '第一表 (2) 类推出来的简化字',
  'table2-1': '第二表 1. 同音代替字',
  'table2-2': '第二表 2. 形声字',
  'table2-3': '第二表 3. 特征字',
  'table2-4': '第二表 4. 轮廓字',
  'table2-5': '第二表 5. 草书楷化字',
  'table2-6': '第二表 6. 会意字',
  'table2-7': '第二表 7. 符号字',
  'table2-8-2-comp': '第二表 8(2) 不能单独成字的简化偏旁',
  'table2-8-analogical': '第二表 8. 类推简化字',
}

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? (section || '—')
}
