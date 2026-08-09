/** 링크를 앱 밖(기본 브라우저)에서 연다.
 *  웹뷰 안에서 열어 버리면 메모짱이 통째로 그 페이지로 바뀌므로 반드시 밖으로 보낸다. */
import { isTauri } from './env'
import { normalizeUrl } from '../utils/url'
import { describeError, notify } from '../ui/toast'

export async function openExternal(url: string): Promise<void> {
  const target = normalizeUrl(url)
  if (!target) return
  try {
    if (isTauri()) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(target)
    } else {
      window.open(target, '_blank', 'noopener')
    }
  } catch (err) {
    notify(`열지 못했습니다 — ${describeError(err)}`, 'error')
  }
}
