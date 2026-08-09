/** 상태 줄에서 왼쪽 아래로 펼쳐지는 노트 목록.
 *
 *  Ctrl+F 의 찾기와 목적이 다르다. 그쪽은 본문까지 뒤져 "그 말이 어디 있나" 를 찾고,
 *  이쪽은 이름만 보고 "그 노트로 가자" 는 쪽이다. 그래서 목록이 늘 펼쳐져 있고
 *  검색칸은 거들 뿐이라 아래에 붙여 둔다 — 여는 자리(상태 줄)에서 가장 가깝다. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from '../store/boardStore'
import { useUi } from '../store/uiStore'
import { focusNote } from '../actions/layout'
import type { Note, NoteKind } from '../types'
import { Icon } from './Icon'

const KIND_LABEL: Record<NoteKind, string> = { todo: '할일', memo: '메모', image: '그림', link: '링크' }

/** 이름이 비었을 때 목록에서 알아볼 수 있도록 본문 앞머리를 조금 빌려 온다. */
function subtitleOf(note: Note): string {
  if (note.kind === 'memo') return note.body.trim().split('\n')[0] ?? ''
  if (note.kind === 'todo') return note.items.map((i) => i.text).filter(Boolean).join(', ')
  if (note.kind === 'link') return note.items.map((i) => i.label || i.url).join(', ')
  return note.file
}

export function NoteListMenu({ onClose }: { onClose: () => void }) {
  const notes = useBoard((s) => s.notes)
  const noteIds = useBoard((s) => s.noteIds)
  const selection = useBoard((s) => s.selection)
  const fullscreenId = useUi((s) => s.fullscreenNoteId)

  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // 상태 줄의 여는 단추까지 포함해서 봐야 한 번 더 눌렀을 때 제대로 닫힌다.
      const target = e.target as Node
      if (!ref.current?.contains(target) && !(target as HTMLElement).closest?.('.footer__btn')) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    // 최근에 만든 것이 위로. 목록을 여는 이유는 대개 방금 만든 것을 다시 찾기 위해서다.
    const all = noteIds
      .map((id) => notes[id])
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
    if (!needle) return all
    return all.filter((n) => n.title.toLowerCase().includes(needle))
  }, [noteIds, notes, query])

  const go = (id: string) => {
    focusNote(id)
    onClose()
  }

  return (
    <div className="notelist bevel-out" ref={ref} role="dialog" aria-label="노트 목록">
      <div className="notelist__items">
        {rows.length === 0 && (
          <p className="notelist__empty">
            {query.trim() ? '그런 이름의 노트가 없습니다.' : '아직 노트가 없습니다.'}
          </p>
        )}
        {rows.map((note) => (
          <button
            key={note.id}
            type="button"
            className={`notelist__item${
              note.id === (fullscreenId ?? selection[0]) ? ' notelist__item--on' : ''
            }`}
            onClick={() => go(note.id)}
          >
            <span className="notelist__kind">{KIND_LABEL[note.kind]}</span>
            <span className="notelist__title">{note.title}</span>
            <span className="notelist__sub">{subtitleOf(note) || '(비어 있음)'}</span>
          </button>
        ))}
      </div>

      <div className="notelist__find">
        <Icon name="search" />
        <input
          className="notelist__input"
          autoFocus
          value={query}
          placeholder="노트 이름으로 찾기…"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // 걸린 게 하나면 Enter 로 바로 간다. 목록을 눈으로 훑을 필요가 없다.
            if (e.key === 'Enter' && rows.length) {
              e.preventDefault()
              go(rows[0].id)
            }
          }}
        />
        <span className="notelist__count">{rows.length}개</span>
      </div>
    </div>
  )
}
