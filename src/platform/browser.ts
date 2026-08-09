/** 링크를 앱 밖(기본 브라우저)에서 연다.
 *  웹뷰 안에서 열어 버리면 메모짱이 통째로 그 페이지로 바뀌므로 반드시 밖으로 보낸다. */
import { isTauri } from './env'
import { normalizeUrl } from '../utils/url'
import { describeError, notify } from '../ui/toast'

/** 열어 줄 스킴. `javascript:` 같은 것은 여는 순간 코드가 되므로 아예 받지 않는다.
 *  캔버스 파일은 남에게 받을 수 있으니 그 안의 주소도 남이 적은 것으로 보아야 한다. */
const OPENABLE = /^https?:\/\//i

export async function openExternal(url: string): Promise<void> {
  const target = normalizeUrl(url)
  if (!target) return
  if (!OPENABLE.test(target)) {
    notify('http 또는 https 주소만 열 수 있습니다.', 'error')
    return
  }
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
