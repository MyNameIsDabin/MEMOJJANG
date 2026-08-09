/** 보드 안 내용 찾기. 노트가 수십 장 넘어가면 눈으로 훑는 게 불가능해진다. */
import type { Note, NoteKind } from '../types'
import { useBoard } from '../store/boardStore'

export interface SearchHit {
  id: string
  kind: NoteKind
  title: string
  /** 찾은 말 주변을 잘라낸 미리보기 */
  snippet: string
}

const SNIPPET_BEFORE = 24
const SNIPPET_AFTER = 48

/** 노트에서 검색 대상이 되는 글자를 한 덩어리로 뽑는다. */
function searchableText(note: Note): string {
  switch (note.kind) {
    case 'todo':
      return note.items.map((it) => it.text).join('\n')
    case 'memo':
      return note.body
    case 'link':
      // 별칭과 주소 둘 다 걸리게 한다.
      return note.items.map((it) => `${it.label} ${it.url}`).join('\n')
    case 'image':
      // 그림에는 찾을 글자가 없다. 제목으로만 걸린다.
      return ''
  }
}

function makeSnippet(body: string, at: number, length: number): string {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(body.length, at + length + SNIPPET_AFTER)
  // 줄바꿈이 섞이면 한 줄 미리보기가 깨진다.
  const text = body.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${text}${end < body.length ? '…' : ''}`
}

export function searchNotes(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const { notes, noteIds } = useBoard.getState()
  const hits: SearchHit[] = []

  for (const id of noteIds) {
    const note = notes[id]
    if (!note) continue

    const body = searchableText(note)
    const at = body.toLowerCase().indexOf(needle)
    if (at >= 0) {
      hits.push({ id, kind: note.kind, title: note.title, snippet: makeSnippet(body, at, needle.length) })
      continue
    }

    // 본문에 없어도 제목이 맞으면 찾은 것으로 친다.
    if (note.title.toLowerCase().includes(needle)) {
      hits.push({ id, kind: note.kind, title: note.title, snippet: makeSnippet(body, 0, 0) })
    }
  }

  return hits
}
