/** 마크다운을 그려 둔 채로 고치게 하는 **꾸밈**.
 *
 *  옵시디언의 '라이브 프리뷰' 와 같은 방식이다. 글은 언제나 원문 마크다운 그대로 있고,
 *  화면에만 덧칠을 얹는다 — `#` 나 `**` 같은 표시는 감추고, 제목은 크게, 목록에는 점을 찍는다.
 *  **캐럿이 놓인 자리에서는 감추지 않는다.** 고치려면 표시가 보여야 하기 때문이다.
 *
 *  왜 이렇게 하나: 글을 고치는 일 자체는 CodeMirror 가 한다. 그쪽은 조합(한글)·선택·
 *  되돌리기·방향키가 이미 다 되어 있다. 우리는 '어떻게 보이나' 만 얹는다.
 *  그래서 여기서 잘못되어도 **모양이 조금 어긋날 뿐, 글이 안 써지지는 않는다.**
 *
 *  ViewPlugin 이 아니라 StateField 인 이유: 코드 울타리 줄은 통째로 접어 없애야 하는데,
 *  그런 **블록** 데코레이션은 플러그인이 낼 수 없고 상태 항목만 낼 수 있다. */
import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Range, RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'

/** 표시 문자를 아예 없는 것처럼 만든다. 지우는 게 아니라 감추는 것뿐이다. */
const hidden = Decoration.replace({})
/** 줄 하나를 통째로 접는다. 코드 울타리처럼 감추고 나면 남길 것이 없는 줄에 쓴다. */
const foldedLine = Decoration.replace({ block: true })

/** 목록 앞의 점. `-` 를 감춘 자리에 대신 세운다. */
class BulletWidget extends WidgetType {
  toDOM() {
    const dot = document.createElement('span')
    dot.className = 'cm-md-bullet'
    dot.textContent = '•'
    return dot
  }
  eq() {
    return true
  }
}

/** 구분선(`---`). 줄 전체를 가로줄 하나로 바꾼다. */
class RuleWidget extends WidgetType {
  toDOM() {
    const bar = document.createElement('span')
    bar.className = 'cm-md-rule'
    return bar
  }
  eq() {
    return true
  }
}

/** 마크다운 마디 이름 -> 줄에 입힐 꾸밈. 제목 크기가 여기서 갈린다. */
const LINE_CLASS: Record<string, string> = {
  ATXHeading1: 'cm-md-h1',
  ATXHeading2: 'cm-md-h2',
  ATXHeading3: 'cm-md-h3',
  ATXHeading4: 'cm-md-h4',
  ATXHeading5: 'cm-md-h5',
  ATXHeading6: 'cm-md-h6',
  Blockquote: 'cm-md-quote',
  FencedCode: 'cm-md-code',
  CodeBlock: 'cm-md-code',
}

/** 글자 모양만 바꾸는 마디들. 표시 문자는 따로 감춘다. */
const MARK_CLASS: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong',
  Emphasis: 'cm-md-em',
  Strikethrough: 'cm-md-strike',
  InlineCode: 'cm-md-inlinecode',
  Link: 'cm-md-link',
}

/** 감출 표시 문자들. 마디 이름이 곧 '이건 문법이지 글이 아니다' 라는 뜻이다. */
const MARKERS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'QuoteMark',
  'LinkMark',
  'URL',
  // 코드 울타리 뒤의 말(```js 의 js)
  'CodeInfo',
])

/** 여러 줄을 먹는 덩어리. 캐럿이 **덩어리 안 어디에라도** 있으면 통째로 원문을 보인다. */
const BLOCKS = new Set(['FencedCode', 'CodeBlock'])

const FENCE = /^\s*(```|~~~)/

function build(state: EditorState): DecorationSet {
  const marks: Range<Decoration>[] = []
  const doc = state.doc

  /* 캐럿이 걸친 줄들. 이 줄에서는 표시를 감추지 않는다.
     여러 곳을 골랐을 때도 고른 줄은 전부 원문으로 둔다 — 고르는 중이면 고치려는 참이다. */
  const bare = new Set<number>()
  for (const range of state.selection.ranges) {
    const from = doc.lineAt(range.from).number
    const to = doc.lineAt(range.to).number
    for (let n = from; n <= to; n += 1) bare.add(n)
  }
  const touches = (from: number, to: number) =>
    state.selection.ranges.some((r) => r.to >= from && r.from <= to)

  /** 통째로 접어 없앤 줄. 그 안의 표시 문자는 따로 감추면 안 된다 — 겹치면 어긋난다. */
  const folded = new Set<number>()

  /* 코드 블록 안에 있는 동안은 이 값을 본다. 줄 단위가 아니라 **덩어리 단위**여야 한다 —
     울타리 줄만 떠났다고 울타리가 사라지면, 안에서 글을 쓰다 블록이 접혀 버린다. */
  let blockDepth = 0
  let blockRaw = false

  syntaxTree(state).iterate({
    leave: (node) => {
      if (BLOCKS.has(node.name)) blockDepth -= 1
    },
    enter: (node) => {
      if (BLOCKS.has(node.name)) {
        blockDepth += 1
        if (blockDepth === 1) blockRaw = touches(node.from, node.to)
      }
      const lineNo = doc.lineAt(node.from).number
      // 덩어리 안이면 덩어리의 판단을 따르고, 아니면 줄의 판단을 따른다.
      const raw = blockDepth > 0 ? blockRaw : bare.has(lineNo)

      /* 코드 울타리 줄은 감추고 나면 남길 글이 없다. 빈 줄로 두면 까닭 없는 여백처럼 보이니
         줄 자체를 접는다. 블록의 경계는 바탕색이 알려 준다. */
      if (node.name === 'FencedCode' && !raw) {
        const first = doc.lineAt(node.from)
        const lastLine = doc.lineAt(Math.min(node.to, doc.length))
        for (const line of [first, lastLine]) {
          if (folded.has(line.number) || !FENCE.test(line.text)) continue
          folded.add(line.number)
          marks.push(foldedLine.range(line.from, line.to))
        }
      }

      /* 여러 줄을 먹는 마디(코드 블록·인용)는 **줄마다** 입혀야 한다.
         첫 줄에만 입히면 코드 블록을 여러 줄로 쓸 때 둘째 줄부터 평범한 글로 보인다. */
      const lineClass = LINE_CLASS[node.name]
      if (lineClass) {
        const first = doc.lineAt(node.from).number
        const last = doc.lineAt(Math.min(node.to, doc.length)).number
        for (let n = first; n <= last; n += 1) {
          if (!folded.has(n)) {
            marks.push(Decoration.line({ class: lineClass }).range(doc.line(n).from))
          }
        }
        return
      }

      // 접어 없앤 줄 안의 것은 건드리지 않는다.
      if (folded.has(lineNo)) return

      const markClass = MARK_CLASS[node.name]
      if (markClass) {
        marks.push(Decoration.mark({ class: markClass }).range(node.from, node.to))
        return
      }

      // 표시 문자 — 캐럿이 떠나면 감춘다. 캐럿이 있을 때 울타리는 옅게 보인다.
      if (MARKERS.has(node.name) && node.to > node.from) {
        if (!raw) marks.push(hidden.range(node.from, node.to))
        else if (node.name === 'CodeMark' && node.to - node.from >= 3) {
          marks.push(Decoration.mark({ class: 'cm-md-fence' }).range(node.from, node.to))
        }
        return
      }

      // 목록 표식은 감추는 대신 점으로 바꾼다. 자리가 비면 목록으로 안 보인다.
      if (node.name === 'ListMark') {
        const text = doc.sliceString(node.from, node.to)
        const ordered = /\d/.test(text)
        if (!raw && !ordered) {
          marks.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to))
        } else {
          marks.push(Decoration.mark({ class: 'cm-md-listmark' }).range(node.from, node.to))
        }
        return
      }

      if (node.name === 'HorizontalRule' && !raw) {
        marks.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to))
      }
    },
  })

  // 데코레이션은 자리 순서대로 넣어야 한다. 훑는 차례가 그 순서를 보장하지 않는다.
  marks.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  const builder = new RangeSetBuilder<Decoration>()
  for (const mark of marks) builder.add(mark.from, mark.to, mark.value)
  return builder.finish()
}

export const livePreview = StateField.define<DecorationSet>({
  create: (state) => build(state),
  // 캐럿이 움직이기만 해도 다시 칠해야 한다 — 떠난 자리는 다시 감춰져야 하니까.
  update: (deco, tr) => (tr.docChanged || tr.selection ? build(tr.state) : deco),
  provide: (field) => EditorView.decorations.from(field),
})
