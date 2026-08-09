/** 메모짱 도메인 모델. 보드 파일(board.json)에 그대로 직렬화되는 형태이므로
 *  필드를 바꿀 때는 storage.ts 의 migrate() 도 함께 손봐야 한다. */

/** 예전에 있던 'clip'(클립보드) 은 없앴다. 글자만 담을 때는 메모와 다를 게 없었고,
 *  쓸모 있었던 쪽은 그림이었기 때문이다. 옛 파일은 읽을 때 알아서 옮겨진다. */
export type NoteKind = 'todo' | 'memo' | 'image' | 'link'

/** 노트 제목 표시줄 색. 실제 색값은 global.css 의 --accent-* 변수에 있다. */
export type AccentKey = 'butter' | 'mint' | 'peach' | 'sky' | 'lilac' | 'slate'

export const ACCENTS: AccentKey[] = ['butter', 'mint', 'peach', 'sky', 'lilac', 'slate']

export interface TodoItem {
  id: string
  text: string
  done: boolean
  /** 마감 시각 (epoch ms). 없으면 마감을 안 정한 것. */
  due?: number
  /** 마감을 정한 시각. 진행도 막대가 "얼마나 지났나" 를 재는 시작점이 된다. */
  dueSetAt?: number
}

interface NoteBase {
  id: string
  /** 월드 좌표. 화면 좌표가 아니라 캔버스 고유 좌표계다. */
  x: number
  y: number
  w: number
  h: number
  /** 겹침 순서. 클수록 위. */
  z: number
  accent: AccentKey
  /** 제목 표시줄만 남기고 접은 상태 */
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

export interface TodoNote extends NoteBase {
  kind: 'todo'
  title: string
  items: TodoItem[]
}

/** 메모 본문을 어떻게 보여줄지. */
export type MemoView = 'plain' | 'markdown' | 'code' | 'json' | 'html'

export interface MemoNote extends NoteBase {
  kind: 'memo'
  title: string
  body: string
  /** 없으면 'plain'. 자동으로 정해졌든 손으로 골랐든 한 번 정해지면 그대로 간다. */
  view?: MemoView
}

/** 붙여넣은 그림 한 장. 바이트는 캔버스 파일에 넣지 않고 옆 폴더에 두고 이름만 적는다. */
export interface ImageNote extends NoteBase {
  kind: 'image'
  title: string
  file: string
  naturalW: number
  naturalH: number
}

/** 바로가기 하나. 별칭을 비워 두면 화면에는 주소의 호스트가 대신 나온다. */
export interface LinkItem {
  id: string
  url: string
  label: string
}

/** 자주 가는 곳을 모아 두는 메모지. */
export interface LinkNote extends NoteBase {
  kind: 'link'
  title: string
  items: LinkItem[]
}

export type Note = TodoNote | MemoNote | ImageNote | LinkNote

/** 사용자가 직접 만들 수 있는 종류. 그림은 붙여넣기·불러오기로만 생긴다. */
export const CREATABLE_KINDS = ['todo', 'memo', 'link'] as const
export type CreatableKind = (typeof CREATABLE_KINDS)[number]

export interface Viewport {
  /** 화면 좌표 = 월드 좌표 * zoom + {x, y} */
  x: number
  y: number
  zoom: number
}

export const CANVAS_VERSION = 1

/** 캔버스 하나 = 사용자가 고른 자리에 놓인 파일 하나.
 *  붙여넣은 그림은 파일이 커지지 않도록 옆의 `.assets` 폴더에 따로 둔다. */
export interface CanvasDoc {
  version: number
  name: string
  notes: Note[]
  viewport: Viewport
}

/** 열려 있는 캔버스 한 칸. 실제 내용은 path 가 가리키는 파일에 있다. */
export interface CanvasRef {
  id: string
  path: string
  name: string
}

export const WORKSPACE_VERSION = 1

/** 어떤 캔버스들을 열어 뒀는지 — 앱 데이터 폴더에 남는 앱 자신의 상태다. */
export interface Workspace {
  version: number
  canvases: CanvasRef[]
  activeId: string | null
}

/** 캔버스 파일 확장자. 두 겹인 이유는 탐색기에서 한눈에 알아보게 하려고. */
export const CANVAS_EXT = 'mjb.json'

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 4

/** 새 노트를 만들 때 쓰는 기본 크기 (월드 단위) */
export const DEFAULT_SIZE: Record<NoteKind, { w: number; h: number }> = {
  todo: { w: 260, h: 220 },
  memo: { w: 280, h: 200 },
  image: { w: 260, h: 200 },
  link: { w: 240, h: 190 },
}

export const MIN_NOTE_W = 140
export const MIN_NOTE_H = 80

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
