/** 메모짱 도메인 모델. 보드 파일(board.json)에 그대로 직렬화되는 형태이므로
 *  필드를 바꿀 때는 storage.ts 의 migrate() 도 함께 손봐야 한다. */
import type { MessageKey } from './i18n'

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

/** 그림 위에 덧그린 획 하나.
 *
 *  좌표는 **원본 그림의 픽셀** 기준이다. 노트를 늘리거나 캔버스를 확대해도 그림과 함께
 *  자연스럽게 따라가고, 원본 파일은 손대지 않으므로 언제든 되돌릴 수 있다. */
export interface Stroke {
  color: string
  /** 선 굵기 — 원본 픽셀 기준 */
  width: number
  /** [x0, y0, x1, y1, …] */
  points: number[]
}

/** 붙여넣은 그림 한 장. 바이트는 캔버스 파일에 넣지 않고 옆 폴더에 두고 이름만 적는다. */
export interface ImageNote extends NoteBase {
  kind: 'image'
  title: string
  file: string
  naturalW: number
  naturalH: number
  /** 연필로 덧그린 것. 없으면 아무것도 안 그린 것. */
  strokes?: Stroke[]
}

/** 연필 색. 어떤 그림 위에서도 하나쯤은 보이도록 골랐다. */
export const PEN_COLORS = ['#ff4d4f', '#ffd75e', '#4dd07a', '#5aa9ff', '#ffffff', '#141414']
/** 연필 굵기(원본 픽셀). 그림 크기가 제각각이라 실제로는 여기에 비율을 곱해 쓴다. */
export const PEN_SIZES = [0.004, 0.008, 0.016]

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

/* ── 꾸미기 스티커 ────────────────────────────────────────────────────
   보관함(StickerAsset)은 앱에 딸리고 여러 캔버스에서 함께 쓴다.
   캔버스에 붙여 놓은 한 장(Sticker)만 캔버스 파일에 남는다. */

/** 보관함에 담긴 그림 한 장. 파일은 앱 데이터 폴더의 `stickers/` 에 있다. */
export interface StickerAsset {
  id: string
  name: string
  file: string
  naturalW: number
  naturalH: number
}

/** 스티커를 어느 켜에 그릴지.
 *  - `behind` — 노트 뒤, 캔버스 위. 붙어 있지 않은 스티커의 자리.
 *  - `body`   — 노트 **안쪽**. 종이의 무늬처럼 본문 밑에 깔린다. 노트에 붙어 있어야 뜻이 있다.
 *  - `front`  — 노트 위. 노트에 붙이면 여기서 시작한다. */
export type StickerLayer = 'behind' | 'body' | 'front'

/** 스티커를 오려 내는 틀. */
export type StickerMask = 'none' | 'circle' | 'star'

/** 노트에 붙었을 때 어디를 기준으로 삼을지.
 *  노트 크기가 바뀌면 이 자리가 따라 움직이고, 스티커도 그만큼 함께 간다.
 *  오른쪽 아래에 매달아 두면 노트를 늘려도 늘 오른쪽 아래에 남는다. */
export type StickerAnchor = 'nw' | 'ne' | 'sw' | 'se' | 'center'

export const STICKER_ANCHORS: { value: StickerAnchor; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { value: 'nw', labelKey: 'sticker.anchorNW', hintKey: 'sticker.anchorHintNW' },
  { value: 'ne', labelKey: 'sticker.anchorNE', hintKey: 'sticker.anchorHintNE' },
  { value: 'sw', labelKey: 'sticker.anchorSW', hintKey: 'sticker.anchorHintSW' },
  { value: 'se', labelKey: 'sticker.anchorSE', hintKey: 'sticker.anchorHintSE' },
  { value: 'center', labelKey: 'sticker.anchorCenter', hintKey: 'sticker.anchorHintCenter' },
]

/** 캔버스 위에 붙여 놓은 스티커 한 장. */
export interface Sticker {
  id: string
  assetId: string
  /** 붙어 있는 노트. null 이면 캔버스 배경 위에 그냥 놓인 것. */
  noteId: string | null
  /** 노트에 붙었을 때 기준으로 삼는 자리. 붙어 있지 않으면 뜻이 없다. */
  anchor: StickerAnchor
  /** 스티커 **중심**의 자리. 배경 위면 월드 좌표, 노트에 붙어 있으면 기준점에서의 어긋남.
   *  중심을 기준으로 잡아야 돌리고 키울 때 자리가 밀리지 않는다. */
  x: number
  y: number
  /** 기본 크기 대비 배율 */
  scale: number
  /** 시계 방향 각도(도) */
  rotation: number
  layer: StickerLayer
  /** 0.1 ~ 1 */
  opacity: number
  /** 색을 빼고 흑백으로 */
  mono: boolean
  mask: StickerMask
}

export const STICKER_MIN_OPACITY = 0.1

/** 스티커 꾸러미 — 남에게 건네주는 파일 하나.
 *
 *  그림을 따로 딸려 보내면 받는 쪽에서 짝을 잃기 쉬우므로 **바이트까지 이 안에** 담는다.
 *  base64 라 원본보다 1/3 쯤 커지지만, 파일 하나로 끝난다는 편함이 그보다 크다. */
export interface StickerPack {
  format: 'memojjang-stickers'
  version: number
  stickers: {
    name: string
    /** 예: image/png */
    mime: string
    /** base64 로 담은 그림 바이트 */
    data: string
    naturalW: number
    naturalH: number
  }[]
}

export const STICKER_PACK_VERSION = 1
export const STICKER_PACK_EXT = 'mjsticker.json'

/** 캔버스에 처음 놓을 때 긴 변의 길이(월드 단위). */
export const STICKER_BASE_PX = 160
export const STICKER_MIN_SCALE = 0.15
export const STICKER_MAX_SCALE = 6
/** 보관함에 담을 때 이보다 큰 그림은 줄여서 담는다. 원본을 그대로 두면 파일만 무거워진다. */
export const STICKER_MAX_PX = 512
/** 이보다 큰 파일은 받지 않는다. */
export const STICKER_MAX_BYTES = 4 * 1024 * 1024

export const CANVAS_VERSION = 1

/** 캔버스 하나 = 사용자가 고른 자리에 놓인 파일 하나.
 *  붙여넣은 그림은 파일이 커지지 않도록 옆의 `.assets` 폴더에 따로 둔다. */
export interface CanvasDoc {
  version: number
  name: string
  notes: Note[]
  viewport: Viewport
  /** 꾸미기로 붙여 놓은 스티커. 옛 파일에는 없다. */
  stickers?: Sticker[]
}

/** 열려 있는 캔버스 한 칸. 실제 내용은 path 가 가리키는 파일에 있다. */
export interface CanvasRef {
  id: string
  path: string
  name: string
}

/** 최근에 열었던 캔버스 한 자리.
 *  탭을 닫아도 여기 남아, 폴더를 다시 뒤지지 않고 되찾을 수 있다.
 *  경로만 들고 있으므로 그새 파일이 옮겨졌을 수 있다 — 여는 쪽에서 감당한다. */
export interface RecentCanvas {
  path: string
  name: string
  /** 마지막으로 연 때 (epoch ms). 목록 차례를 정하는 데만 쓴다. */
  at: number
}

/** 최근 기록은 이만큼만 남긴다. 더 쌓아 두면 메뉴가 목록이 되어 버린다. */
export const RECENT_LIMIT = 10

export const WORKSPACE_VERSION = 1

/** 어떤 캔버스들을 열어 뒀는지 — 앱 데이터 폴더에 남는 앱 자신의 상태다. */
export interface Workspace {
  version: number
  canvases: CanvasRef[]
  activeId: string | null
  /** 없을 수도 있다 — 이 항목이 생기기 전에 저장된 파일이 그렇다.
   *  더하기만 했으므로 판올림 번호는 그대로 둔다. 옛 앱이 읽어도 이 줄만 못 본 척한다. */
  recent?: RecentCanvas[]
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
