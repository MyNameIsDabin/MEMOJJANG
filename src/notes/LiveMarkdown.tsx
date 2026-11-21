/** 마크다운을 그려 둔 채로 고치는 칸. 따로 원문 모드가 없다.
 *
 *  **글을 고치는 일은 CodeMirror 가 한다.** 조합(한글)·선택·되돌리기·방향키·마우스 끌기가
 *  이미 다 되어 있는 물건이라, 우리가 다시 만들지 않는다.
 *
 *  전에는 한 번에 한 줄만 진짜 글칸이고 나머지는 그린 것이었다. 그러면 브라우저가 공짜로
 *  해 주던 일(줄 넘나드는 방향키, 여러 줄 선택, 되돌리기…)을 전부 손으로 다시 만들어야 했고,
 *  하나를 고치면 다음이 나왔다. 목록이 유한하지 않았다.
 *
 *  지금은 글칸이 하나뿐이고 문서 전체가 그 안에 있다. 마크다운처럼 **보이게** 하는 일만
 *  덧칠로 얹는다(livePreview.ts). 그래서 그쪽이 틀려도 모양이 어긋날 뿐 글은 써진다. */
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { Strikethrough, TaskList } from '@lezer/markdown'
import type { ScreenRect } from '../actions/layout'
import { livePreview } from './livePreview'
import { slashMenu } from './slashMenu'
import { findMark, revealInEditor } from './findMark'
import { STALE_MS } from './reveal'
import { useT } from '../i18n'

/** 바깥(MemoBody)이 편집기에 부탁할 수 있는 것. 에디터 객체를 통째로 내주지 않는다. */
export interface LiveMarkdownHandle {
  reveal: (at: number, length: number, select: boolean, show: (rect: ScreenRect) => void) => void
}

export function LiveMarkdown({
  text,
  onChange,
  ref,
}: {
  text: string
  onChange: (next: string) => void
  ref?: Ref<LiveMarkdownHandle>
}) {
  const say = useT()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  /** 우리가 밀어 넣은 마지막 글. 밖에서 바뀐 것과 가르는 데 쓴다. */
  const pushed = useRef(text)
  /** 최신 onChange. 에디터는 한 번만 만들고 오래 사는데, 이 함수는 렌더마다 새로 온다. */
  const sink = useRef(onChange)
  sink.current = onChange
  /** 마지막 찾기 부탁과 그때. 에디터가 새로 만들어지면 방금 온 부탁을 새 에디터에 다시 건다.
   *  개발 모드(StrictMode)는 새로 생긴 에디터를 한 번 부수고 다시 만드는데, 부탁은 그 사이
   *  곧 버려질 첫 번째 에디터에 걸린다. 메모 본문까지 새로 생길 때는 부모(useReveal) 효과도
   *  다시 돌아 괜찮지만, 에디터만 새로 생길 때(펼쳐 보기에서 그대로 보기 메모 → 마크다운 메모)는
   *  부모가 다시 돌지 않아 여기서 받아야 한다. */
  const lastReveal = useRef<{ args: Parameters<LiveMarkdownHandle['reveal']>; at: number } | null>(null)

  /* 아래 두 효과가 레이아웃 효과인 이유: 찾기(MemoBody 의 useReveal)가 레이아웃 효과에서
     자리를 짚는다. 자식의 레이아웃 효과는 부모 것보다 먼저 돌므로, 이렇게 해야 펼쳐 보던 노트를
     다른 노트로 갈아 끼울 때 에디터가 이미 있고 새 글이 들어간 뒤에 찾는다.
     보통 효과로 두면 옛 글 위에서 자리를 짚고, 곧이어 글이 통째로 바뀌며 그 자리가 지워진다. */
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          // 할 일(`- [ ]`)과 취소선(`~~`)은 기본 CommonMark 에 없다. 그 둘만 더한다.
          markdown({ extensions: [TaskList, Strikethrough] }),
          livePreview,
          slashMenu,
          findMark,
          EditorView.lineWrapping,
          cmPlaceholder(say('memo.placeholder')),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            const next = update.state.doc.toString()
            pushed.current = next
            sink.current(next)
          }),
        ],
      }),
    })
    viewRef.current = view
    const last = lastReveal.current
    if (last && Date.now() - last.at < STALE_MS) revealInEditor(view, ...last.args)
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // 에디터는 노트 하나에 하나. 글이 바뀐다고 새로 만들지 않는다 — 아래 효과가 따라간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 밖에서 글이 바뀌면(되돌리기, 다른 창에서의 고침) 따라간다.
     우리가 민 글이 돌아온 것은 밖에서 바뀐 것이 아니므로 건드리지 않는다 —
     건드리면 캐럿이 튀고, 조합 중이면 조합이 끊긴다. */
  useLayoutEffect(() => {
    const view = viewRef.current
    if (!view || text === pushed.current) return
    if (text === view.state.doc.toString()) return
    pushed.current = text
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
  }, [text])

  useImperativeHandle(
    ref,
    () => ({
      reveal: (...args) => {
        lastReveal.current = { args, at: Date.now() }
        const view = viewRef.current
        if (view) revealInEditor(view, ...args)
      },
    }),
    [],
  )

  return (
    <div
      ref={hostRef}
      className="md__live"
      // 왼쪽 끌기는 글을 고르는 데 쓴다. 노트가 따라 움직이면 안 된다.
      onPointerDown={(e) => {
        if (e.button === 0) e.stopPropagation()
      }}
    />
  )
}
