/** 자주 가는 곳을 모아 두는 메모지. 누르면 기본 브라우저로 열린다. */
import { useState } from 'react'
import { newId, type LinkItem, type LinkNote } from '../types'
import { useBoard } from '../store/boardStore'
import { openExternal } from '../platform/browser'
import { Icon } from '../ui/Icon'
import { Favicon } from './Favicon'
import { hostOf, normalizeUrl } from '../utils/url'

export function LinkBody({ note }: { note: LinkNote }) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const write = (items: LinkItem[]) => useBoard.getState().patchNote(note.id, { items })

  const patchItem = (itemId: string, patch: Partial<LinkItem>) =>
    write(note.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))

  const add = () => {
    const fresh: LinkItem = { id: newId(), url: '', label: '' }
    write([...note.items, fresh])
    // 새로 만든 줄은 바로 고칠 수 있게 열어 둔다.
    setEditingId(fresh.id)
  }

  const drop = (itemId: string) => {
    write(note.items.filter((it) => it.id !== itemId))
    if (editingId === itemId) setEditingId(null)
  }

  /** 주소를 비워 둔 채 편집을 닫으면 빈 줄만 남는다. 그럴 땐 지운다. */
  const closeEditor = (item: LinkItem) => {
    setEditingId(null)
    if (!item.url.trim()) drop(item.id)
  }

  return (
    <div className="links">
      <div className="links__list">
        {note.items.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="links__edit">
              <input
                className="links__input"
                value={item.label}
                placeholder="별칭 (비우면 주소가 나옵니다)"
                autoFocus
                onPointerDown={(e) => {
                  if (e.button === 0) e.stopPropagation()
                }}
                onChange={(e) => patchItem(item.id, { label: e.target.value })}
              />
              <input
                className="links__input"
                value={item.url}
                placeholder="example.com"
                spellCheck={false}
                onPointerDown={(e) => {
                  if (e.button === 0) e.stopPropagation()
                }}
                onChange={(e) => patchItem(item.id, { url: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') closeEditor(item)
                }}
              />
              <div className="links__editfoot">
                <button type="button" className="links__act" onClick={() => closeEditor(item)}>
                  확인
                </button>
                <button type="button" className="links__act links__act--drop" onClick={() => drop(item.id)}>
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div key={item.id} className="links__row">
              <button
                type="button"
                className="links__go"
                title={normalizeUrl(item.url) || '주소가 비어 있습니다'}
                onClick={() => void openExternal(item.url)}
              >
                <Favicon url={item.url} label={item.label} />
                <span className="links__label">{item.label.trim() || hostOf(item.url) || '(빈 주소)'}</span>
              </button>
              <button
                type="button"
                className="links__act"
                title="고치기"
                onClick={() => setEditingId(item.id)}
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                className="links__act links__act--drop"
                title="지우기"
                onClick={() => drop(item.id)}
              >
                <Icon name="close" />
              </button>
            </div>
          ),
        )}
      </div>

      <div className="links__foot">
        <button type="button" className="links__add" onClick={add}>
          + 바로가기
        </button>
        <span>{note.items.length}개</span>
      </div>
    </div>
  )
}
