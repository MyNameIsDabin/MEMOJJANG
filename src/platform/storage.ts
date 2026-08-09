/** 앱 자신의 상태 — 설정과 "어떤 캔버스를 열어 뒀는지".
 *
 *  사용자 문서(캔버스)는 여기 있지 않다. 그건 사용자가 고른 자리에 파일로 저장되며
 *  canvasFile.ts 가 맡는다. 여기 있는 것은 지우더라도 메모가 날아가지 않는다.
 */
import type { Workspace } from '../types'
import { isTauri } from './env'

const SETTINGS_FILE = 'settings.json'
const WORKSPACE_FILE = 'workspace.json'

const LS_SETTINGS = 'memojjang:settings'
const LS_WORKSPACE = 'memojjang:workspace'

/** 앱 데이터 폴더는 범위가 고정돼 있어 fs 플러그인으로 충분하다. */
async function fs() {
  return import('@tauri-apps/plugin-fs')
}

async function readJson<T>(name: string): Promise<T | null> {
  const { readTextFile, exists, BaseDirectory } = await fs()
  const opts = { baseDir: BaseDirectory.AppData }
  if (!(await exists(name, opts).catch(() => false))) return null
  try {
    return JSON.parse(await readTextFile(name, opts)) as T
  } catch (err) {
    console.error(`[storage] ${name} 파싱 실패 — 기본값으로 시작합니다.`, err)
    return null
  }
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const { writeTextFile, mkdir, BaseDirectory } = await fs()
  const opts = { baseDir: BaseDirectory.AppData }
  // recursive 는 이미 있으면 조용히 넘어간다.
  await mkdir('', { ...opts, recursive: true }).catch(() => {})
  await writeTextFile(name, JSON.stringify(value, null, 2), opts)
}

function readLocal<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const storage = {
  async loadSettings<T>(): Promise<T | null> {
    return isTauri() ? readJson<T>(SETTINGS_FILE) : readLocal<T>(LS_SETTINGS)
  },

  async saveSettings(value: unknown): Promise<void> {
    if (isTauri()) await writeJson(SETTINGS_FILE, value)
    else localStorage.setItem(LS_SETTINGS, JSON.stringify(value))
  },

  async loadWorkspace(): Promise<Workspace | null> {
    return isTauri() ? readJson<Workspace>(WORKSPACE_FILE) : readLocal<Workspace>(LS_WORKSPACE)
  },

  async saveWorkspace(value: Workspace): Promise<void> {
    if (isTauri()) await writeJson(WORKSPACE_FILE, value)
    else localStorage.setItem(LS_WORKSPACE, JSON.stringify(value))
  },

  /** 설정 패널의 "앱 데이터 폴더 열기" 용. */
  async revealDataFolder(): Promise<void> {
    if (!isTauri()) return
    const [{ appDataDir }, { openPath }] = await Promise.all([
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-opener'),
    ])
    await openPath(await appDataDir())
  },
}
