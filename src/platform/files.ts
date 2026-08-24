/** 임의 경로 파일 입출력.
 *
 *  fs 플러그인 대신 Rust 명령을 쓴다 — 캔버스 파일은 사용자가 어느 드라이브에든 둘 수 있어야 하는데
 *  플러그인 쪽은 미리 정한 폴더로 범위가 묶이기 때문이다. (src-tauri/src/files.rs 참고)
 *
 *  브라우저에서는 파일 시스템이 없으므로 localStorage 를 경로 이름표로 흉내 낸다.
 *  UI 개발용이며, 실제 파일로 저장되지는 않는다.
 */
import { isTauri } from './env'

const LS_PREFIX = 'memojjang:file:'

async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const files = {
  async readText(path: string): Promise<string | null> {
    if (isTauri()) return call<string | null>('read_text_file', { path })
    return localStorage.getItem(LS_PREFIX + path)
  },

  async writeText(path: string, contents: string): Promise<void> {
    if (isTauri()) return call('write_text_file', { path, contents })
    localStorage.setItem(LS_PREFIX + path, contents)
  },

  /** base64 문자열로 돌려준다. 없으면 null. */
  async readBinary(path: string): Promise<string | null> {
    if (isTauri()) return call<string | null>('read_binary_file', { path })
    return localStorage.getItem(LS_PREFIX + path)
  },

  async writeBinary(path: string, base64Data: string): Promise<void> {
    if (isTauri()) return call('write_binary_file', { path, base64Data })
    try {
      localStorage.setItem(LS_PREFIX + path, base64Data)
    } catch {
      console.warn('[files] localStorage 용량 초과 — 브라우저 모드에서는 큰 그림이 남지 않습니다.')
    }
  },

  async remove(path: string): Promise<void> {
    if (isTauri()) return call('delete_file', { path })
    localStorage.removeItem(LS_PREFIX + path)
  },

  async exists(path: string): Promise<boolean> {
    if (isTauri()) return call<boolean>('file_exists', { path })
    return localStorage.getItem(LS_PREFIX + path) !== null
  },

  /** 폴더 안의 파일 이름들. 없는 폴더는 빈 목록.
   *  브라우저 모드에는 폴더가 없다 — 흉내 낸 이름표에서 앞자리가 맞는 것만 추린다. */
  async list(dir: string): Promise<string[]> {
    if (isTauri()) return call<string[]>('list_dir', { path: dir })
    // 구분자까지 맞춰 봐야 한다. 앞자리만 보면 `보드.assets2\...` 가 `보드.assets` 것으로 딸려 온다.
    const prefix = `${LS_PREFIX}${dir}${separatorOf(dir)}`
    const names: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      // 한 겹 아래의 것만. 폴더 안의 폴더는 파일이 아니다.
      if (rest && !/[\\/]/.test(rest)) names.push(rest)
    }
    return names
  },

  /** 파일이든 폴더든 옮긴다. */
  async rename(from: string, to: string): Promise<void> {
    if (isTauri()) return call('rename_path', { from, to })
    const value = localStorage.getItem(LS_PREFIX + from)
    if (value === null) return
    localStorage.setItem(LS_PREFIX + to, value)
    localStorage.removeItem(LS_PREFIX + from)
  },

  /** 탐색기에서 이 파일을 골라 놓은 채로 폴더를 연다. */
  async reveal(path: string): Promise<void> {
    if (!isTauri()) return
    return call('reveal_in_explorer', { path })
  },
}

/* ── 경로 다루기 ───────────────────────────────────────────────────────
   Node 의 path 모듈이 없으므로 필요한 만큼만 직접 만든다.
   경로에 역슬래시가 섞여 있으면 Windows 로 보고 구분자를 맞춘다. */

export function separatorOf(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}

export function joinPath(dir: string, name: string): string {
  const sep = separatorOf(dir)
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`
}

export function baseName(path: string): string {
  const sep = separatorOf(path)
  const at = path.lastIndexOf(sep)
  return at >= 0 ? path.slice(at + 1) : path
}

export function dirName(path: string): string {
  const sep = separatorOf(path)
  const at = path.lastIndexOf(sep)
  return at >= 0 ? path.slice(0, at) : ''
}

/** 확장자를 떼어낸 이름. `내 보드.mjb.json` -> `내 보드` */
export function stemOf(path: string): string {
  return baseName(path).replace(/\.mjb\.json$/i, '').replace(/\.json$/i, '')
}
