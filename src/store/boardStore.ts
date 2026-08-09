/** 보드 상태. 노트는 id -> Note 맵으로 들고 있어서
 *  하나를 옮겨도 나머지 노트가 리렌더되지 않는다(노트마다 selector 구독). */
import { create } from 'zustand'
import {
  DEFAULT_SIZE,
  MAX_ZOOM,
  MIN_NOTE_H,
  MIN_NOTE_W,
  MIN_ZOOM,
  STICKER_MAX_SCALE,
  STICKER_MIN_SCALE,
  newId,
  type AccentKey,
  type CanvasDoc,
  type CreatableKind,
  type Note,
  type NoteKind,
  type Sticker,
  type StickerAnchor,
  type Viewport,
} from '../types'
import { deleteImage } from '../platform/assets'
import { useSettings } from './settingsStore'
import { detectView } from '../notes/detect'

/** 되돌리기용 스냅샷. 구조 변경(추가/삭제/이동/크기)에만 쌓고 타이핑에는 쌓지 않는다.
 *  글자 되돌리기는 textarea 의 브라우저 기본 실행취소가 이미 해준다. */
interface Snapshot {
  notes: Record<string, Note>
  noteIds: string[]
  stickers: Record<string, Sticker>
  stickerIds: string[]
}

const UNDO_LIMIT = 50

const DEFAULT_ACCENT: Record<NoteKind, AccentKey> = {
  todo: 'mint',
  memo: 'butter',
  image: 'sky',
  link: 'lilac',
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 픽셀 폰트는 정수 배율에서 제일 또렷하다. 근처를 지나갈 때 살짝 붙잡아 준다. */
const ZOOM_SNAPS = [0.5, 1, 2, 3, 4]
const SNAP_TOLERANCE = 0.03

function snapZoom(zoom: number): number {
  for (const s of ZOOM_SNAPS) {
    if (Math.abs(zoom - s) / s < SNAP_TOLERANCE) return s
  }
  return zoom
}

interface BoardState {
  notes: Record<string, Note>
  noteIds: string[]
  stickers: Record<string, Sticker>
  stickerIds: string[]
  viewport: Viewport
  selection: string[]
  /** 캔버스를 다 읽기 전에는 자동 저장이 돌면 안 된다.
   *  캔버스를 갈아 끼우는 동안에도 잠깐 false 가 되어, 옛 내용이 새 파일에 쓰이는 것을 막는다. */
  hydrated: boolean

  past: Snapshot[]
  future: Snapshot[]

  hydrate: (doc: CanvasDoc | null) => void
  /** 캔버스 전환 시작 — 다음 hydrate 까지 자동 저장을 멈춘다. */
  unhydrate: () => void
  /** 파일에 쓸 알맹이. 캔버스 이름은 파일 계층이 붙인다. */
  contents: () => Pick<CanvasDoc, 'notes' | 'viewport' | 'stickers'>

  addNote: (kind: CreatableKind, world: { x: number; y: number }) => string
  /** 붙여넣은 글자를 메모로 얹는다. */
  addMemo: (body: string, world: { x: number; y: number }) => string
  /** 붙여넣은 그림을 얹는다. 파일은 이미 저장돼 있어야 한다. */
  addImage: (
    image: { file: string; naturalW: number; naturalH: number },
    world: { x: number; y: number },
  ) => string
  patchNote: (id: string, patch: Partial<Note>) => void
  moveNotes: (ids: string[], dx: number, dy: number) => void
  resizeNote: (id: string, w: number, h: number) => void
  removeNotes: (ids: string[]) => void
  duplicateNotes: (ids: string[]) => void
  raise: (id: string) => void

  /** 스티커를 캔버스 배경 위(월드 좌표)에 새로 붙인다. */
  addSticker: (assetId: string, world: { x: number; y: number }) => string
  patchSticker: (id: string, patch: Partial<Sticker>) => void
  removeSticker: (id: string) => void
  /** 노트에 붙인다. 지금 자리를 그 노트의 기준점에서 잰 값으로 바꿔 둔다. */
  attachSticker: (id: string, noteId: string, anchor: StickerAnchor) => void
  /** 기준점만 갈아 끼운다. 보이는 자리는 그대로 두고 재는 곳만 옮긴다. */
  setStickerAnchor: (id: string, anchor: StickerAnchor) => void
  /** 떼어 낸다. 붙어 있던 자리 그대로 캔버스 배경 위에 남는다. */
  detachSticker: (id: string) => void

  setViewport: (vp: Viewport | ((prev: Viewport) => Viewport)) => void
  zoomAt: (screenX: number, screenY: number, factor: number) => void

  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void

  commit: () => void
  undo: () => void
  redo: () => void
}

/** 이미지는 원본 비례를 지키되 처음 붙일 때 너무 커지지 않게 가둔다. */
function fitImage(naturalW: number, naturalH: number) {
  const MAX = 420
  const MIN = 120
  if (!naturalW || !naturalH) return DEFAULT_SIZE.image
  const scale = Math.min(1, MAX / Math.max(naturalW, naturalH))
  return {
    w: Math.max(MIN, Math.round(naturalW * scale)),
    h: Math.max(MIN, Math.round(naturalH * scale)) + imageChromeHeight(),
  }
}

/** 그림 노트에서 그림이 아닌 부분(제목 표시줄 + 아래 정보줄 + 테두리)의 높이.
 *  원본 비율을 맞출 때 여기에 더해야 위아래로 남는 여백 없이 액자에 딱 찬다.
 *  글자 크기를 키우면 표시줄도 같이 커지므로 배율을 곱해 준다. */
const IMAGE_CHROME_BASE = 46

export function imageChromeHeight(): number {
  return Math.round(IMAGE_CHROME_BASE * useSettings.getState().fontScale)
}

function baseNote(kind: NoteKind, world: { x: number; y: number }, z: number) {
  const now = Date.now()
  const { w, h } = DEFAULT_SIZE[kind]
  return {
    id: newId(),
    kind,
    // 클릭한 지점이 노트의 좌상단이 아니라 중앙 근처가 되도록 살짝 당긴다.
    x: Math.round(world.x - w / 2),
    y: Math.round(world.y - 16),
    w,
    h,
    z,
    accent: DEFAULT_ACCENT[kind],
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** 기준점이 노트 좌상단에서 얼마나 떨어져 있는가.
 *  노트 크기가 바뀌면 이 값이 따라 바뀌고, 그래서 스티커가 모서리를 따라간다. */
function anchorOffset(note: Note, anchor: StickerAnchor): { x: number; y: number } {
  const fx = anchor === 'ne' || anchor === 'se' ? 1 : anchor === 'center' ? 0.5 : 0
  const fy = anchor === 'sw' || anchor === 'se' ? 1 : anchor === 'center' ? 0.5 : 0
  return { x: note.w * fx, y: note.h * fy }
}

/** 노트 좌상단에서 잰 스티커 중심의 자리. 노트 안쪽에 깔 때 이 좌표를 그대로 쓴다. */
export function localOf(sticker: Sticker, note: Note): { x: number; y: number } {
  const at = anchorOffset(note, sticker.anchor)
  return { x: at.x + sticker.x, y: at.y + sticker.y }
}

/** 스티커의 실제 월드 좌표. 노트에 붙어 있으면 그 노트의 기준점에서 재어 더한다. */
export function worldOf(sticker: Sticker, note: Note | undefined): { x: number; y: number } {
  if (!sticker.noteId || !note) return { x: sticker.x, y: sticker.y }
  const local = localOf(sticker, note)
  return { x: note.x + local.x, y: note.y + local.y }
}

export const useBoard = create<BoardState>()((set, get) => {
  const topZ = () => {
    const { notes, noteIds } = get()
    return noteIds.reduce((max, id) => Math.max(max, notes[id]?.z ?? 0), 0)
  }

  const snapshot = (): Snapshot => {
    const { notes, noteIds, stickers, stickerIds } = get()
    return {
      notes: { ...notes },
      noteIds: [...noteIds],
      stickers: { ...stickers },
      stickerIds: [...stickerIds],
    }
  }

  const insert = (note: Note) => {
    get().commit()
    set((s) => ({
      notes: { ...s.notes, [note.id]: note },
      noteIds: [...s.noteIds, note.id],
      selection: [note.id],
    }))
    return note.id
  }

  return {
    notes: {},
    noteIds: [],
    stickers: {},
    stickerIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: [],
    hydrated: false,
    past: [],
    future: [],

    unhydrate: () => set({ hydrated: false }),

    hydrate: (doc) => {
      const empty = {
        notes: {},
        noteIds: [],
        stickers: {},
        stickerIds: [],
        selection: [],
        hydrated: true,
        past: [],
        future: [],
      }
      if (!doc?.notes) {
        set({ ...empty, viewport: { x: 0, y: 0, zoom: 1 } })
        return
      }
      const notes: Record<string, Note> = {}
      const noteIds: string[] = []
      for (const n of doc.notes) {
        notes[n.id] = n
        noteIds.push(n.id)
      }

      const stickers: Record<string, Sticker> = {}
      const stickerIds: string[] = []
      for (const s of doc.stickers ?? []) {
        // 붙어 있던 노트가 사라진 캔버스라면 배경 위로 돌려놓는다.
        // 없는 노트를 가리킨 채로 두면 화면 어디에도 그려지지 않는다.
        stickers[s.id] = s.noteId && !notes[s.noteId] ? { ...s, noteId: null } : s
        stickerIds.push(s.id)
      }

      set({
        ...empty,
        notes,
        noteIds,
        stickers,
        stickerIds,
        viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
      })
    },

    contents: () => {
      const { notes, noteIds, stickers, stickerIds, viewport } = get()
      return {
        notes: noteIds.map((id) => notes[id]).filter(Boolean),
        stickers: stickerIds.map((id) => stickers[id]).filter(Boolean),
        viewport,
      }
    },

    addNote: (kind, world) => {
      const base = baseNote(kind, world, topZ() + 1)
      const note: Note =
        kind === 'todo'
          ? { ...base, kind: 'todo', title: '할 일', items: [{ id: newId(), text: '', done: false }] }
          : kind === 'link'
            ? { ...base, kind: 'link', title: '바로가기', items: [] }
            : { ...base, kind: 'memo', title: '메모', body: '' }
      return insert(note)
    },

    addMemo: (body, world) => {
      const base = baseNote('memo', world, topZ() + 1)
      // 붙여넣기로 만들어지는 메모는 내용이 통째로 들어오는 순간이므로 여기서 한 번 살펴본다.
      const { memoAutoDetect, memoUserRules, memoDisabledBuiltins } = useSettings.getState()
      const view =
        memoAutoDetect && body.trim()
          ? detectView(body, { userRules: memoUserRules, disabledBuiltins: memoDisabledBuiltins })
          : 'plain'
      return insert({ ...base, kind: 'memo', title: '메모', body, view })
    },

    addImage: (image, world) => {
      const base = baseNote('image', world, topZ() + 1)
      const size = fitImage(image.naturalW, image.naturalH)
      return insert({
        ...base,
        kind: 'image',
        title: '이미지',
        ...image,
        w: size.w,
        h: size.h,
        // 크기가 바뀌었으니 중앙 정렬을 다시 잡는다.
        x: Math.round(world.x - size.w / 2),
      })
    },

    patchNote: (id, patch) =>
      set((s) => {
        const prev = s.notes[id]
        if (!prev) return s
        return {
          notes: { ...s.notes, [id]: { ...prev, ...patch, updatedAt: Date.now() } as Note },
        }
      }),

    moveNotes: (ids, dx, dy) =>
      set((s) => {
        if (!dx && !dy) return s
        const notes = { ...s.notes }
        for (const id of ids) {
          const n = notes[id]
          if (n) notes[id] = { ...n, x: n.x + dx, y: n.y + dy, updatedAt: Date.now() }
        }
        return { notes }
      }),

    resizeNote: (id, w, h) =>
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        return {
          notes: {
            ...s.notes,
            [id]: {
              ...n,
              w: Math.max(MIN_NOTE_W, Math.round(w)),
              h: Math.max(MIN_NOTE_H, Math.round(h)),
              updatedAt: Date.now(),
            },
          },
        }
      }),

    removeNotes: (ids) => {
      if (!ids.length) return
      get().commit()
      const { notes } = get()
      // 딸린 이미지 파일도 같이 지운다. 실패해도 노트 삭제는 진행한다.
      for (const id of ids) {
        const n = notes[id]
        if (n?.kind === 'image') void deleteImage(n.file)
      }
      set((s) => {
        const next = { ...s.notes }
        for (const id of ids) delete next[id]

        // 그 노트에 붙어 있던 스티커는 지우지 않는다. 붙어 있던 자리 그대로
        // 캔버스 배경 위에 남긴다 — 노트를 지웠다고 꾸며 놓은 것까지 사라지면 놀란다.
        const stickers = { ...s.stickers }
        for (const sid of s.stickerIds) {
          const sticker = stickers[sid]
          if (!sticker?.noteId || !ids.includes(sticker.noteId)) continue
          const world = worldOf(sticker, s.notes[sticker.noteId])
          stickers[sid] = { ...sticker, noteId: null, x: world.x, y: world.y, layer: 'behind' }
        }

        return {
          notes: next,
          noteIds: s.noteIds.filter((id) => !ids.includes(id)),
          selection: s.selection.filter((id) => !ids.includes(id)),
          stickers,
        }
      })
    },

    duplicateNotes: (ids) => {
      if (!ids.length) return
      get().commit()
      const { notes } = get()
      const clones: Note[] = []
      let z = topZ()
      for (const id of ids) {
        const src = notes[id]
        if (!src) continue
        clones.push({ ...src, id: newId(), x: src.x + 24, y: src.y + 24, z: ++z, createdAt: Date.now() })
      }
      set((s) => {
        const nextNotes = { ...s.notes }
        for (const c of clones) nextNotes[c.id] = c
        return {
          notes: nextNotes,
          noteIds: [...s.noteIds, ...clones.map((c) => c.id)],
          selection: clones.map((c) => c.id),
        }
      })
    },

    addSticker: (assetId, world) => {
      get().commit()
      const sticker: Sticker = {
        id: newId(),
        assetId,
        noteId: null,
        anchor: 'nw',
        x: Math.round(world.x),
        y: Math.round(world.y),
        scale: 1,
        rotation: 0,
        layer: 'behind',
        opacity: 1,
        mono: false,
        mask: 'none',
      }
      set((s) => ({
        stickers: { ...s.stickers, [sticker.id]: sticker },
        stickerIds: [...s.stickerIds, sticker.id],
      }))
      return sticker.id
    },

    patchSticker: (id, patch) =>
      set((s) => {
        const cur = s.stickers[id]
        if (!cur) return s
        const next = { ...cur, ...patch }
        if (patch.scale !== undefined) {
          next.scale = clamp(patch.scale, STICKER_MIN_SCALE, STICKER_MAX_SCALE)
        }
        return { stickers: { ...s.stickers, [id]: next } }
      }),

    removeSticker: (id) => {
      get().commit()
      set((s) => {
        const stickers = { ...s.stickers }
        delete stickers[id]
        return { stickers, stickerIds: s.stickerIds.filter((i) => i !== id) }
      })
    },

    attachSticker: (id, noteId, anchor) => {
      const { stickers, notes } = get()
      const sticker = stickers[id]
      const note = notes[noteId]
      if (!sticker || !note) return
      get().commit()
      // 지금 보이는 자리를 그대로 두려면 좌표계를 바꿔 줘야 한다.
      const world = sticker.noteId ? worldOf(sticker, notes[sticker.noteId]) : sticker
      const base = worldOf({ ...sticker, noteId, anchor, x: 0, y: 0 }, note)
      set((s) => ({
        stickers: {
          ...s.stickers,
          [id]: {
            ...sticker,
            noteId,
            anchor,
            x: Math.round(world.x - base.x),
            y: Math.round(world.y - base.y),
            // 노트에 붙인 순간에는 노트 위로 올린다. 가려져 버리면 붙인 보람이 없다.
            // 본문 밑에 깔고 싶으면 아래 도구 줄에서 옮기면 된다.
            layer: 'front',
          },
        },
      }))
    },

    setStickerAnchor: (id, anchor) => {
      const { stickers, notes } = get()
      const sticker = stickers[id]
      if (!sticker?.noteId) return
      const note = notes[sticker.noteId]
      if (!note || sticker.anchor === anchor) return
      get().commit()
      // 재는 곳만 옮기고 눈에 보이는 자리는 그대로 둔다 — 기준을 바꿨다고 스티커가
      // 훌쩍 날아가 버리면 무엇이 바뀐 건지 알 수 없다.
      const world = worldOf(sticker, note)
      const base = worldOf({ ...sticker, anchor, x: 0, y: 0 }, note)
      set((s) => ({
        stickers: {
          ...s.stickers,
          [id]: { ...sticker, anchor, x: Math.round(world.x - base.x), y: Math.round(world.y - base.y) },
        },
      }))
    },

    detachSticker: (id) => {
      const { stickers, notes } = get()
      const sticker = stickers[id]
      if (!sticker?.noteId) return
      get().commit()
      const world = worldOf(sticker, notes[sticker.noteId])
      set((s) => ({
        stickers: {
          ...s.stickers,
          [id]: { ...sticker, noteId: null, x: Math.round(world.x), y: Math.round(world.y), layer: 'behind' },
        },
      }))
    },

    raise: (id) =>
      set((s) => {
        const n = s.notes[id]
        if (!n) return s
        const max = s.noteIds.reduce((m, i) => Math.max(m, s.notes[i]?.z ?? 0), 0)
        if (n.z === max) return s
        return { notes: { ...s.notes, [id]: { ...n, z: max + 1 } } }
      }),

    setViewport: (vp) =>
      set((s) => {
        const next = typeof vp === 'function' ? vp(s.viewport) : vp
        return { viewport: { ...next, zoom: clamp(next.zoom, MIN_ZOOM, MAX_ZOOM) } }
      }),

    zoomAt: (screenX, screenY, factor) =>
      set((s) => {
        const { x, y, zoom } = s.viewport
        const next = snapZoom(clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM))
        if (next === zoom) return s
        // 커서 밑의 월드 좌표가 제자리에 머물도록 오프셋을 다시 계산한다.
        const worldX = (screenX - x) / zoom
        const worldY = (screenY - y) / zoom
        return { viewport: { x: screenX - worldX * next, y: screenY - worldY * next, zoom: next } }
      }),

    select: (ids) => set({ selection: ids }),

    toggleSelect: (id) =>
      set((s) => ({
        selection: s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id],
      })),

    clearSelection: () => set({ selection: [] }),

    commit: () =>
      set((s) => ({
        past: [...s.past, snapshot()].slice(-UNDO_LIMIT),
        future: [],
      })),

    undo: () =>
      set((s) => {
        const prev = s.past.at(-1)
        if (!prev) return s
        return {
          ...prev,
          past: s.past.slice(0, -1),
          future: [...s.future, snapshot()],
          selection: s.selection.filter((id) => prev.notes[id]),
        }
      }),

    redo: () =>
      set((s) => {
        const next = s.future.at(-1)
        if (!next) return s
        return {
          ...next,
          past: [...s.past, snapshot()],
          future: s.future.slice(0, -1),
          selection: s.selection.filter((id) => next.notes[id]),
        }
      }),
  }
})

/** 화면 좌표 -> 월드 좌표 */
export const toWorld = (vp: Viewport, screenX: number, screenY: number) => ({
  x: (screenX - vp.x) / vp.zoom,
  y: (screenY - vp.y) / vp.zoom,
})

export { clamp, MIN_ZOOM, MAX_ZOOM }
