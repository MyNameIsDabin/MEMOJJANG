/** 메모 노트 — 그냥 자유롭게 쓰는 칸.
 *
 *  아래 정보줄에서 보기 방식을 고른다. 기본은 '그대로'.
 *  자동 추론은 **내용이 통째로 새로 들어올 때만** 한 번 돈다:
 *  빈 메모에 처음 붙여넣거나, 전체를 잡아 놓고 다른 글로 갈아치울 때.
 *  글자를 칠 때마다 유형이 바뀌면 쓰는 사람이 놀라기 때문이다. */
import { useEffect, useRef, useState } from 'react'
import type { MemoNote, MemoView } from '../types'
import { useBoard } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { VIEW_LABEL, detectView } from './detect'
import { LiveMarkdown } from './LiveMarkdown'
import { HtmlPreview } from './HtmlPreview'
import { JsonView } from './JsonView'
import { Icon } from '../ui/Icon'
import { useT } from '../i18n'

const VIEWS: MemoView[] = ['plain', 'markdown', 'code', 'json', 'html']

export function MemoBody({ note }: { note: MemoNote }) {
  const say = useT()
  const view = note.view ?? 'plain'
  const autoDetect = useSettings((s) => s.memoAutoDetect)
  const [editing, setEditing] = useState(false)

  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  /** 이번 입력이 "통째로 갈아치우기" 인가. beforeinput 때 미리 봐 둔다. */
  const wholeReplace = useRef(false)

  // 입력이 일어나기 직전의 선택 범위를 봐야 "전체 선택 상태였는지" 를 알 수 있다.
  // change 시점에는 이미 사라지고 없다.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const onBeforeInput = (e: Event) => {
      const input = e as InputEvent
      const pasted = input.inputType === 'insertFromPaste' || input.inputType === 'insertFromDrop'
      const all = el.selectionStart === 0 && el.selectionEnd === el.value.length
      wholeReplace.current = pasted && (all || el.value === '')
    }
    el.addEventListener('beforeinput', onBeforeInput)
    return () => el.removeEventListener('beforeinput', onBeforeInput)
  }, [])

  const onChange = (next: string) => {
    const shouldDetect = autoDetect && wholeReplace.current && next.trim().length > 0
    wholeReplace.current = false

    const patch: Partial<MemoNote> = { body: next }
    if (shouldDetect) {
      const { memoUserRules, memoDisabledBuiltins } = useSettings.getState()
      patch.view = detectView(next, {
        userRules: memoUserRules,
        disabledBuiltins: memoDisabledBuiltins,
      })
    }
    useBoard.getState().patchNote(note.id, patch)
  }

  const setView = (next: MemoView) => {
    useBoard.getState().patchNote(note.id, { view: next })
    setEditing(false)
  }

  // 마크다운은 그려 둔 채로 고친다 — 캐럿이 놓인 줄만 원문이 드러난다(LiveMarkdown).
  // 그래서 원문 칸으로 통째로 돌아가는 것은 연필 단추를 눌렀을 때뿐이다.
  const live = view === 'markdown'
  // JSON·HTML 은 그려서 보여주기만 하므로, 고치려면 잠시 원문으로 돌아가야 한다.
  const rendered = view === 'html' || view === 'json'
  const showSource = (!rendered && !live) || editing

  return (
    <div className="memo">
      {showSource ? (
        <textarea
          ref={areaRef}
          className={`memo__text${view === 'code' ? ' memo__text--code' : ''}`}
          value={note.body}
          placeholder={say('memo.placeholder')}
          spellCheck={false}
          // 휠 클릭은 캔버스가 화면을 옮기는 데 써야 하므로 막지 않는다.
          onPointerDown={(e) => {
            if (e.button === 0) e.stopPropagation()
          }}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            // 잠깐 원문으로 들어온 것뿐이니, 노트 밖으로 손을 옮기면 다시 그려서 보여준다.
            // 아래 정보줄의 단추로 옮겨간 것이라면 그대로 둔다 — 그쪽이 알아서 처리한다.
            if (!rendered && !live) return
            const note = e.currentTarget.closest('.note')
            if (!note?.contains(e.relatedTarget as Node | null)) setEditing(false)
          }}
        />
      ) : live ? (
        <div className="memo__rendered">
          <LiveMarkdown text={note.body} onChange={onChange} />
        </div>
      ) : (
        <div
          className="memo__rendered"
          onPointerDown={(e) => {
            if (e.button === 0) e.stopPropagation()
          }}
          onDoubleClick={() => setEditing(true)}
          title={say('memo.editHint')}
        >
          {view === 'json' && <JsonView text={note.body} />}
          {view === 'html' && <HtmlPreview html={note.body} />}
        </div>
      )}

      <div className="memo__foot">
        <select
          className="memo__view"
          value={view}
          title={say('memo.view')}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setView(e.target.value as MemoView)}
        >
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {say(VIEW_LABEL[v])}
            </option>
          ))}
        </select>

        {(rendered || live) && (
          <button
            type="button"
            className="memo__act"
            aria-pressed={editing}
            title={say(editing ? 'memo.render' : 'memo.edit')}
            onClick={() => setEditing((v) => !v)}
          >
            <Icon name={editing ? 'fit' : 'pencil'} />
          </button>
        )}

        <span className="memo__count">{say('memo.chars', { n: note.body.length })}</span>
      </div>
    </div>
  )
}
