/** 보드 안 내용 찾기. 노트가 수십 장 넘어가면 눈으로 훑는 게 불가능해진다. */
import type { Note, NoteKind } from '../types'
import { useBoard } from '../store/boardStore'
import type { Spot } from '../notes/reveal'

export interface SearchHit {
  id: string
  kind: NoteKind
  title: string
  /** 찾은 말 주변을 잘라낸 미리보기 */
  snippet: string
  /** 노트 안 어디서 찾았나. 글이 길면 노트로 데려가는 것만으로는 그 말이 안 보인다.
   *  제목으로만 걸렸으면 없다. */
  spot?: Spot
}

const SNIPPET_BEFORE = 24
const SNIPPET_AFTER = 48

/** 노트에서 검색 대상이 되는 글 조각들. 항목이 있는 노트는 조각마다 어느 항목인지 함께 든다. */
function pieces(note: Note): { itemId?: string; text: string }[] {
  switch (note.kind) {
    case 'todo':
      return note.items.map((it) => ({ itemId: it.id, text: it.text }))
    case 'memo':
      return [{ text: note.body }]
    case 'link':
      // 별칭과 주소 둘 다 걸리게 한다.
      return note.items.map((it) => ({ itemId: it.id, text: `${it.label} ${it.url}` }))
    case 'image':
      // 그림에는 찾을 글자가 없다. 제목으로만 걸린다.
      return []
  }
}

type Piece = ReturnType<typeof pieces>[number]

function firstMatch(parts: Piece[], needle: string): { part: Piece; at: number } | null {
  for (const part of parts) {
    const at = part.text.toLowerCase().indexOf(needle)
    if (at >= 0) return { part, at }
  }
  return null
}

function makeSnippet(body: string, at: number, length: number): string {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(body.length, at + length + SNIPPET_AFTER)
  // 줄바꿈이 섞이면 한 줄 미리보기가 깨진다.
  const text = body.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${text}${end < body.length ? '…' : ''}`
}

/** 찾을 말을 비교하기 좋게 다듬는다. 찾기 창과 노트가 같은 규칙으로 맞춰 봐야 한다. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function searchNotes(query: string): SearchHit[] {
  const needle = normalizeQuery(query)
  if (!needle) return []

  const { notes, noteIds } = useBoard.getState()
  const hits: SearchHit[] = []

  for (const id of noteIds) {
    const note = notes[id]
    if (!note) continue

    const parts = pieces(note)
    const match = firstMatch(parts, needle)
    if (match) {
      const { part, at } = match
      const length = needle.length
      const spot: Spot = part.itemId
        ? { field: 'item', itemId: part.itemId, at, length }
        : { field: 'body', at, length }
      // 미리보기도 그 조각에서만 자른다 — 노트에 가서 반짝이는 곳과 같은 글이어야 한다.
      hits.push({ id, kind: note.kind, title: note.title, snippet: makeSnippet(part.text, at, length), spot })
      continue
    }

    // 본문에 없어도 제목이 맞으면 찾은 것으로 친다.
    if (note.title.toLowerCase().includes(needle)) {
      const body = parts.map((p) => p.text).join('\n')
      hits.push({ id, kind: note.kind, title: note.title, snippet: makeSnippet(body, 0, 0) })
    }
  }

  return hits
}
