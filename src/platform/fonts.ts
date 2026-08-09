/** 직접 더한 글꼴 다루기.
 *
 *  두 갈래가 있다.
 *  - **이름으로 더하기**: 이 컴퓨터에 이미 깔린 글꼴을 부르기만 한다. 파일이 없다.
 *  - **파일에서 더하기**: 고른 파일을 앱 데이터 폴더의 `fonts/` 로 **복사해 둔다.**
 *    원본을 옮기거나 지워도 글꼴이 사라지지 않게 하려는 것이다.
 *
 *  파일은 FontFace 에 바이트를 그대로 넘겨 등록한다. CSS 로 부르지 않으므로
 *  경로도, CSP 의 font-src 도 건드릴 일이 없다.
 */
import { files, baseName } from './files'
import { isTauri } from './env'
import type { UserFont } from '../store/settingsStore'

const DIR = 'fonts'

/** 글꼴 이름은 CSS 에 그대로 들어간다. 따옴표나 꺾쇠가 섞이면 규칙이 깨지므로 털어 낸다. */
function safeFamily(name: string): string {
  return name.replace(/["'<>{};]/g, '').trim()
}

async function fs() {
  return import('@tauri-apps/plugin-fs')
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 이미 등록해 둔 글꼴을 두 번 등록하지 않도록 기억해 둔다. */
const registered = new Set<string>()

/** 저장해 둔 글꼴 파일들을 브라우저에 올린다. 설정을 읽은 직후 한 번 부른다. */
export async function registerUserFonts(fonts: UserFont[]): Promise<void> {
  if (!isTauri()) return
  const { readFile, BaseDirectory } = await fs()

  for (const font of fonts) {
    if (!font.file || registered.has(font.key)) continue
    try {
      const bytes = await readFile(`${DIR}/${font.file}`, { baseDir: BaseDirectory.AppData })
      const face = new FontFace(font.family, bytes)
      await face.load()
      document.fonts.add(face)
      registered.add(font.key)
    } catch (err) {
      // 파일이 사라졌거나 글꼴로 읽히지 않는 경우. 목록에는 남겨 두고 넘어간다 —
      // 여기서 지워 버리면 사용자가 왜 없어졌는지 알 길이 없다.
      console.error(`[fonts] '${font.label}' 을(를) 올리지 못했습니다.`, err)
    }
  }
}

/** 파일을 골라 앱 데이터 폴더로 복사하고, 곧바로 쓸 수 있게 등록까지 한다. */
export async function addFontFromFile(options: {
  basePx: number
  pixel: boolean
}): Promise<UserFont | null> {
  if (!isTauri()) throw new Error('앱에서만 글꼴 파일을 불러올 수 있습니다.')

  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    multiple: false,
    filters: [{ name: '글꼴', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] }],
  })
  if (typeof picked !== 'string') return null

  const base64 = await files.readBinary(picked)
  if (base64 === null) throw new Error('글꼴 파일을 읽지 못했습니다.')

  const name = baseName(picked)
  const stem = safeFamily(name.replace(/\.[^.]+$/, ''))
  if (!stem) throw new Error('글꼴 이름을 알아낼 수 없습니다.')

  const bytes = decodeBase64(base64)
  // 먼저 글꼴로 읽히는지 확인한다. 안 되는 파일을 폴더에 남겨 둘 이유가 없다.
  const face = new FontFace(stem, bytes)
  await face.load()

  const { writeFile, mkdir, BaseDirectory } = await fs()
  const opts = { baseDir: BaseDirectory.AppData }
  await mkdir(DIR, { ...opts, recursive: true }).catch(() => {})
  await writeFile(`${DIR}/${name}`, bytes, opts)

  document.fonts.add(face)

  const key = `user:${stem}:${Date.now().toString(36)}`
  registered.add(key)
  return { key, label: stem, family: stem, file: name, basePx: options.basePx, pixel: options.pixel }
}

/** 이 컴퓨터에 이미 깔린 글꼴을 이름으로 더한다. */
export function addFontByName(name: string, options: { basePx: number; pixel: boolean }): UserFont {
  const family = safeFamily(name)
  if (!family) throw new Error('글꼴 이름을 적어 주세요.')
  return {
    key: `user:${family}:${Date.now().toString(36)}`,
    label: family,
    family,
    basePx: options.basePx,
    pixel: options.pixel,
  }
}

/** 목록에서 빼고, 복사해 둔 파일도 지운다. */
export async function removeUserFont(font: UserFont): Promise<void> {
  registered.delete(font.key)
  if (!font.file || !isTauri()) return
  const { remove, BaseDirectory } = await fs()
  await remove(`${DIR}/${font.file}`, { baseDir: BaseDirectory.AppData }).catch(() => {})
}
