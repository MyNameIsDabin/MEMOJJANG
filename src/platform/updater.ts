/** 새 판이 나왔는지 보고, 받아서 깔기.
 *
 *  판올림 파일은 GitHub 릴리스에 올라가고, 그 옆의 latest.json 이 "지금 최신은 무엇이고
 *  어디서 받는지" 를 알려 준다. 파일에는 서명이 붙어 있고 앱은 공개키로 그것을 확인한다
 *  (tauri.conf.json 의 pubkey). 서명이 맞지 않으면 아예 설치하지 않는다 —
 *  중간에서 누가 바꿔치기한 것을 받아 깔면 그게 곧 남의 코드를 실행하는 일이 되기 때문이다.
 *
 *  브라우저로 띄웠을 때는 이 기능이 통째로 없다. 그래서 부를 때마다 확인한다. */
import { isTauri } from './env'
import { t } from '../i18n'

export interface UpdateInfo {
  version: string
  notes: string
  date: string | null
}

/** 내려받기 진행 상황. total 은 서버가 알려주지 않으면 0 이다. */
export interface Progress {
  downloaded: number
  total: number
}

/** 방금 확인한 판올림. 받아서 깔 때 다시 쓰려고 들고 있는다. */
let pending: Awaited<ReturnType<typeof loadUpdate>> | null = null

async function loadUpdate() {
  const { check } = await import('@tauri-apps/plugin-updater')
  return check()
}

export async function currentVersion(): Promise<string> {
  if (!isTauri()) return t('update.dev')
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

/** 플러그인이 내는 말은 영어인 데다 속사정이 그대로 드러난다.
 *  자주 만나는 두 경우만 사람 말로 바꾸고, 나머지는 원문을 그대로 보여 준다 —
 *  드문 실패까지 뭉뚱그리면 무엇이 잘못됐는지 알 길이 없어진다. */
function friendly(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // 릴리스가 아직 없거나 초안이라 latest.json 이 잡히지 않을 때
  if (/release JSON|404|not found/i.test(raw)) return t('update.none')
  if (/network|dns|connect|timed? out|sending request/i.test(raw)) return t('update.offline')
  return raw
}

/** 새 판이 있으면 그 정보를, 없으면 null 을 준다. 못 물어봤으면 예외를 던진다. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) throw new Error(t('err.appOnlyUpdate'))

  let update
  try {
    update = await loadUpdate()
  } catch (err) {
    throw new Error(friendly(err))
  }
  pending = update
  if (!update) return null

  return {
    version: update.version,
    notes: update.body ?? '',
    date: update.date ?? null,
  }
}

/** 받아서 깔고 앱을 다시 띄운다. 돌아오지 않는 함수다(성공하면 앱이 꺼진다). */
export async function installUpdate(onProgress?: (p: Progress) => void): Promise<void> {
  if (!pending) throw new Error(t('err.checkFirst'))

  let downloaded = 0
  let total = 0

  await pending.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength
    }
    onProgress?.({ downloaded, total })
  })

  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
