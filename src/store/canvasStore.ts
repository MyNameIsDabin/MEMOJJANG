/** 열려 있는 캔버스들과 지금 보고 있는 캔버스.
 *
 *  캔버스 하나는 사용자가 고른 자리의 파일 하나다. 여기에는 목록과 경로만 두고,
 *  실제 노트는 전환할 때마다 boardStore 로 갈아 끼운다. */
import { create } from 'zustand'
import {
  CANVAS_EXT,
  CANVAS_VERSION,
  WORKSPACE_VERSION,
  newId,
  type CanvasDoc,
  type CanvasRef,
} from '../types'
import { useBoard } from './boardStore'
import { storage } from '../platform/storage'
import { emptyCanvas, readCanvas, releaseCanvasImages, writeCanvas } from '../platform/canvasFile'
import { baseName, dirName, files, joinPath, stemOf } from '../platform/files'
import { isTauri } from '../platform/env'
import { describeError, notify } from '../ui/toast'

interface CanvasState {
  canvases: CanvasRef[]
  activeId: string | null
  hydrated: boolean
  /** 파일을 읽고 쓰는 동안 탭을 잠근다. 연타로 두 캔버스가 섞이는 것을 막는다. */
  busy: boolean

  activeCanvas: () => CanvasRef | null
  activePath: () => string | null

  hydrate: () => Promise<void>
  createCanvas: () => Promise<void>
  openCanvas: () => Promise<void>
  switchTo: (id: string) => Promise<void>
  closeCanvas: (id: string) => Promise<void>
  renameCanvas: (id: string, name: string) => void
  revealActive: () => Promise<void>
}

/** 지금 캔버스를 파일에 쓴다. 자동 저장과 전환 직전 모두 이 함수를 지난다. */
export async function saveActiveCanvas(): Promise<void> {
  const state = useCanvases.getState()
  const ref = state.activeCanvas()
  if (!ref) return

  const board = useBoard.getState()
  if (!board.hydrated) return

  const doc: CanvasDoc = { version: CANVAS_VERSION, name: ref.name, ...board.contents() }
  await writeCanvas(ref.path, doc)
}

async function persistWorkspace(): Promise<void> {
  const { canvases, activeId } = useCanvases.getState()
  await storage
    .saveWorkspace({ version: WORKSPACE_VERSION, canvases, activeId })
    .catch((err) => console.error('[canvas] 작업공간 저장 실패', err))
}

/** 캔버스 개념이 없던 판에서 쓰던 단일 보드를 캔버스 하나로 데려온다.
 *  그냥 두면 사용자 눈에는 메모가 전부 사라진 것처럼 보인다. */
async function migrateLegacyBoard(): Promise<CanvasRef | null> {
  if (!isTauri()) return null

  try {
    const { appDataDir } = await import('@tauri-apps/api/path')
    const dir = await appDataDir()
    const legacy = joinPath(dir, 'board.json')
    if (!(await files.exists(legacy))) return null

    // 예전에는 그림이 앱 데이터의 images 폴더에 모여 있었다. 새 규칙에 맞는 자리로 옮긴다.
    const oldImages = joinPath(dir, 'images')
    const newImages = joinPath(dir, 'board.assets')
    if ((await files.exists(oldImages)) && !(await files.exists(newImages))) {
      await files.rename(oldImages, newImages).catch(() => {})
    }

    const ref: CanvasRef = { id: newId(), path: legacy, name: '내 보드' }
    notify('예전에 쓰던 보드를 "내 보드" 탭으로 옮겼습니다.')
    return ref
  } catch (err) {
    console.error('[canvas] 예전 보드 이전 실패', err)
    return null
  }
}

/** 새 캔버스를 만들 때 대화상자에 미리 채워 넣을 경로. */
async function suggestedPath(): Promise<string> {
  const fallback = `새 보드.${CANVAS_EXT}`
  if (!isTauri()) return fallback
  try {
    const { documentDir } = await import('@tauri-apps/api/path')
    return joinPath(joinPath(await documentDir(), '메모짱'), fallback)
  } catch {
    return fallback
  }
}

const FILTERS = [{ name: '메모짱 캔버스', extensions: ['json'] }]

async function askSavePath(): Promise<string | null> {
  if (!isTauri()) {
    const typed = window.prompt('캔버스 파일 이름 (브라우저 모드에서는 흉내만 냅니다)', `새 보드.${CANVAS_EXT}`)
    return typed?.trim() || null
  }
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({ title: '캔버스를 저장할 파일', defaultPath: await suggestedPath(), filters: FILTERS })
}

async function askOpenPath(): Promise<string | null> {
  if (!isTauri()) {
    const typed = window.prompt('열 캔버스 파일 이름')
    return typed?.trim() || null
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ title: '캔버스 열기', multiple: false, directory: false, filters: FILTERS })
  return typeof picked === 'string' ? picked : null
}

/** 사용자가 확장자를 지운 채로 저장하는 일이 흔하다. 조용히 붙여 준다. */
function withExtension(path: string): string {
  return /\.json$/i.test(path) ? path : `${path}.${CANVAS_EXT}`
}

export const useCanvases = create<CanvasState>()((set, get) => {
  /** 파일을 읽어 화면에 올린다. 실패하면 사용자에게 알리고 false. */
  const loadInto = async (ref: CanvasRef): Promise<boolean> => {
    useBoard.getState().unhydrate()
    try {
      const doc = await readCanvas(ref.path)
      if (!doc) {
        notify(`파일을 찾을 수 없습니다 — ${ref.path}`, 'error')
        // 내용은 비워 두되 탭은 남긴다. 사용자가 파일을 되돌려 놓을 수도 있다.
        useBoard.getState().hydrate(null)
        return false
      }
      useBoard.getState().hydrate(doc)
      // 파일 안의 이름이 정본이다. 탭 이름과 어긋나면 파일 쪽을 따른다.
      if (doc.name && doc.name !== ref.name) {
        set((s) => ({ canvases: s.canvases.map((c) => (c.id === ref.id ? { ...c, name: doc.name } : c)) }))
      }
      return true
    } catch (err) {
      notify(`캔버스를 열지 못했습니다 — ${describeError(err)}`, 'error')
      useBoard.getState().hydrate(null)
      return false
    }
  }

  return {
    canvases: [],
    activeId: null,
    hydrated: false,
    busy: false,

    activeCanvas: () => {
      const { canvases, activeId } = get()
      return canvases.find((c) => c.id === activeId) ?? null
    },

    activePath: () => get().activeCanvas()?.path ?? null,

    hydrate: async () => {
      const workspace = await storage.loadWorkspace().catch(() => null)

      if (!workspace) {
        const migrated = await migrateLegacyBoard()
        if (migrated) {
          set({ canvases: [migrated], activeId: migrated.id, hydrated: true })
          await loadInto(migrated)
          await persistWorkspace()
          return
        }
      }

      const canvases = workspace?.canvases ?? []
      const activeId = canvases.some((c) => c.id === workspace?.activeId)
        ? (workspace?.activeId ?? null)
        : (canvases[0]?.id ?? null)

      set({ canvases, activeId, hydrated: true })

      const ref = canvases.find((c) => c.id === activeId)
      if (ref) await loadInto(ref)
      else useBoard.getState().hydrate(null)
    },

    createCanvas: async () => {
      if (get().busy) return
      const picked = await askSavePath()
      if (!picked) return

      const path = withExtension(picked)
      set({ busy: true })
      try {
        if (get().canvases.some((c) => c.path === path)) {
          notify('이미 열려 있는 캔버스입니다.')
          return
        }
        const name = stemOf(path) || '새 보드'
        await writeCanvas(path, emptyCanvas(name))

        await saveActiveCanvas()
        const ref: CanvasRef = { id: newId(), path, name }
        set((s) => ({ canvases: [...s.canvases, ref], activeId: ref.id }))
        await loadInto(ref)
        await persistWorkspace()
      } catch (err) {
        notify(`캔버스를 만들지 못했습니다 — ${describeError(err)}`, 'error')
      } finally {
        set({ busy: false })
      }
    },

    openCanvas: async () => {
      if (get().busy) return
      const path = await askOpenPath()
      if (!path) return

      const already = get().canvases.find((c) => c.path === path)
      if (already) {
        await get().switchTo(already.id)
        return
      }

      set({ busy: true })
      try {
        await saveActiveCanvas()
        const ref: CanvasRef = { id: newId(), path, name: stemOf(path) || baseName(path) }
        set((s) => ({ canvases: [...s.canvases, ref], activeId: ref.id }))
        await loadInto(ref)
        await persistWorkspace()
      } catch (err) {
        notify(`캔버스를 열지 못했습니다 — ${describeError(err)}`, 'error')
      } finally {
        set({ busy: false })
      }
    },

    switchTo: async (id) => {
      const { activeId, canvases, busy } = get()
      if (busy || id === activeId) return
      const ref = canvases.find((c) => c.id === id)
      if (!ref) return

      set({ busy: true })
      try {
        // 떠나기 전에 지금 것을 확실히 저장한다. 미뤄둔 자동 저장이 있을 수 있다.
        await saveActiveCanvas()
        set({ activeId: id })
        await loadInto(ref)
        await persistWorkspace()
      } finally {
        set({ busy: false })
      }
    },

    closeCanvas: async (id) => {
      const { canvases, activeId, busy } = get()
      if (busy) return
      const ref = canvases.find((c) => c.id === id)
      if (!ref) return

      set({ busy: true })
      try {
        if (id === activeId) await saveActiveCanvas()

        const remaining = canvases.filter((c) => c.id !== id)
        // 닫은 것이 보고 있던 탭이면 바로 옆으로 옮겨 간다.
        const at = canvases.findIndex((c) => c.id === id)
        const nextActive =
          id === activeId ? (remaining[Math.min(at, remaining.length - 1)]?.id ?? null) : activeId

        releaseCanvasImages(ref.path)
        set({ canvases: remaining, activeId: nextActive })

        const nextRef = remaining.find((c) => c.id === nextActive)
        if (nextRef) await loadInto(nextRef)
        else useBoard.getState().hydrate(null)

        await persistWorkspace()
      } finally {
        set({ busy: false })
      }
    },

    renameCanvas: (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      set((s) => ({ canvases: s.canvases.map((c) => (c.id === id ? { ...c, name: trimmed } : c)) }))
      // 이름은 파일 안에도 들어간다. 파일만 따로 옮겨도 이름이 따라가도록.
      void saveActiveCanvas().catch(() => {})
      void persistWorkspace()
    },

    revealActive: async () => {
      const ref = get().activeCanvas()
      if (!ref) return
      await files.reveal(ref.path).catch((err) => notify(describeError(err), 'error'))
    },
  }
})

/** 설정 패널 등에서 "이 캔버스가 어디 있는지" 를 보여줄 때. */
export function activeCanvasFolder(): string | null {
  const ref = useCanvases.getState().activeCanvas()
  return ref ? dirName(ref.path) : null
}
