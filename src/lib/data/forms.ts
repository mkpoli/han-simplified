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
  // cn-1977
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
  // cn-1964
  table1: '第一表 不作简化偏旁用的简化字',
  'table2-chars': '第二表 可作简化偏旁用的简化字',
  'table2-components': '第二表 简化偏旁',
  table3: '第三表 应用第二表得出来的简化字',
  appendix: '附录 摘自《第一批异体字整理表》',
  // cn-1935
  'rhyme-01': '（一）ㄚ韵',
  'rhyme-02': '（二）ㄛ韵',
  'rhyme-03': '（三）ㄜ韵',
  'rhyme-04': '（四）ㄝ韵',
  'rhyme-05': '（五）ㄭ韵',
  'rhyme-06': '（六）ㄦ韵',
  'rhyme-07': '（七）ㄧ韵',
  'rhyme-08': '（八）ㄞ韵',
  'rhyme-09': '（九）ㄟ韵',
  'rhyme-10': '（十）ㄨ韵',
  'rhyme-11': '（十一）ㄩ韵',
  'rhyme-12': '（十二）ㄠ韵',
  'rhyme-13': '（十三）ㄡ韵',
  'rhyme-14': '（十四）ㄢ韵',
  'rhyme-15': '（十五）ㄣ韵',
  'rhyme-16': '（十六）ㄤ韵',
  'rhyme-17': '（十七）ㄥ韵',
}

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? (section || '—')
}
