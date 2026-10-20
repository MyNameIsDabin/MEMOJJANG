/** 줄 첫머리에서 `/` 를 치면 뜨는 메뉴 — 노션처럼 고르면 그 자리에 블록이 들어간다.
 *
 *  들어가는 것은 결국 마크다운 표시(`- [ ] `, `# ` …)다. 문법을 외우지 않아도 쓸 수 있게
 *  할 뿐, 글은 여전히 원문 마크다운 그대로 남는다.
 *
 *  고르는 창은 CodeMirror 의 자동 완성에 맡긴다. 방향키·Enter·Esc·마우스가 이미 다 되어 있다.
 *  줄 첫머리에서만 여는 이유: 글 중간의 `/` 는 경로나 분수, 주소일 때가 훨씬 많다. */
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import { EditorSelection } from '@codemirror/state'
import { tooltips } from '@codemirror/view'
import { t, type MessageKey } from '../i18n'

interface Block {
  label: MessageKey
  /** 들어갈 마크다운. */
  insert: string
  /** 넣은 뒤 캐럿이 갈 자리(넣은 글 안에서). 없으면 맨 끝. */
  caret?: number
  /** `/` 뒤에 쳐서 찾을 말. 화면에 나오는 이름으로도 찾는다. */
  words: string[]
}

const BLOCKS: Block[] = [
  { label: 'slash.todo', insert: '- [ ] ', words: ['todo', 'task', 'check', '할일', '체크', '투두'] },
  { label: 'slash.h1', insert: '# ', words: ['h1', 'heading', 'title', '제목'] },
  { label: 'slash.h2', insert: '## ', words: ['h2', 'heading', 'title', '제목'] },
  { label: 'slash.h3', insert: '### ', words: ['h3', 'heading', 'title', '제목'] },
  { label: 'slash.bullet', insert: '- ', words: ['list', 'bullet', 'ul', '목록'] },
  { label: 'slash.number', insert: '1. ', words: ['number', 'ol', '번호'] },
  { label: 'slash.quote', insert: '> ', words: ['quote', '인용'] },
  { label: 'slash.code', insert: '```\n\n```', caret: 4, words: ['code', '코드'] },
  { label: 'slash.divider', insert: '---\n', words: ['divider', 'hr', 'line', '구분선', '줄'] },
]

/** `/` 와 그 뒤에 친 말. 줄 첫머리(들여쓰기는 괜찮다)에 있을 때만 잡는다. */
const TRIGGER = /^\s*\/[^\s/]*$/

export function slashSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)
  if (!TRIGGER.test(before)) return null

  const from = line.from + before.indexOf('/')
  const query = before.slice(before.indexOf('/') + 1).toLowerCase()

  const options: Completion[] = BLOCKS.filter((block) => {
    if (!query) return true
    return block.words.some((w) => w.startsWith(query)) || t(block.label).toLowerCase().includes(query)
  }).map((block) => ({
    label: t(block.label),
    detail: block.insert.split('\n')[0].trim(),
    apply: (view, _completion, start, end) => {
      const caret = start + (block.caret ?? block.insert.length)
      view.dispatch({
        changes: { from: start, to: end, insert: block.insert },
        selection: EditorSelection.cursor(caret),
        userEvent: 'input.complete',
      })
    },
  }))

  // 맞는 것이 없으면 아예 닫는다 — `/usr` 처럼 메뉴를 부를 뜻이 없던 글을 가리지 않게.
  if (!options.length) return null
  // 걸러 내기는 우리가 했다. 화면 이름과 찾는 말이 달라서 기본 걸러 내기에 맡길 수 없다.
  return { from, options, filter: false }
}

export const slashMenu = [
  autocompletion({
    override: [slashSource],
    icons: false,
    tooltipClass: () => 'md-slash',
  }),
  /* 노트는 확대·축소가 걸린 판 위에 있다. 창을 그 안에 띄우면 판과 함께 늘었다 줄었다 하고
     자리도 어긋난다. 바깥(body)에 띄운다. */
  tooltips({ parent: document.body }),
]
