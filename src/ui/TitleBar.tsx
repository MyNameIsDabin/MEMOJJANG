/** 창 제목 표시줄. 운영체제가 그려 주던 부분을 앱이 직접 그린다.
 *
 *  그래야 캔버스 탭을 이 줄에 함께 얹을 수 있고, 창 위쪽이 앱과 끊기지 않고 이어진다.
 *  대신 창을 끌어 옮기는 일까지 우리가 책임진다 — `data-tauri-drag-region` 이 붙은
 *  자리를 누르면 창이 따라온다. 버튼에는 붙이지 않아야 버튼이 제 일을 한다. */
import { useEffect, useState } from 'react'
import { CanvasTabs } from './CanvasTabs'
import { Toolbar } from './Toolbar'
import { Icon } from './Icon'
import { isTauri } from '../platform/env'
import './chrome.css'

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

/** 최대화 상태에 따라 가운데 버튼 모양이 달라진다. */
function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const win = await currentWindow()
      const sync = async () => setMaximized(await win.isMaximized())
      await sync()
      const off = await win.onResized(() => void sync())
      if (cancelled) off()
      else unlisten = off
    })()

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return maximized
}

export function TitleBar() {
  const maximized = useMaximized()

  const run = (action: 'minimize' | 'toggle' | 'close') => async () => {
    if (!isTauri()) return
    const win = await currentWindow()
    if (action === 'minimize') await win.minimize()
    else if (action === 'toggle') await win.toggleMaximize()
    else await win.close()
  }

  return (
    <>
      <div className="titlebar" data-tauri-drag-region>
        <span className="titlebar__mark" data-tauri-drag-region>
          <Icon name="mark" />
          메모짱
        </span>

        {/* 도구 줄이 남는 자리를 다 차지하고, 아이콘 오른쪽의 빈 곳이 창을 끄는 손잡이가 된다 */}
        <Toolbar />

        {isTauri() && <WindowControls maximized={maximized} run={run} />}
      </div>

      {/* 탭은 제목 줄 바로 아래 — 그래야 보고 있는 탭이 캔버스와 끊기지 않고 이어진다 */}
      <CanvasTabs />
    </>
  )
}

function WindowControls({
  maximized,
  run,
}: {
  maximized: boolean
  run: (action: 'minimize' | 'toggle' | 'close') => () => Promise<void>
}) {
  return (
    <div className="wincontrols">
      <button type="button" className="wincontrols__btn" title="최소화" onClick={run('minimize')}>
        <Icon name="winMinimize" />
      </button>
      <button
        type="button"
        className="wincontrols__btn"
        title={maximized ? '이전 크기로' : '최대화'}
        onClick={run('toggle')}
      >
        <Icon name={maximized ? 'winRestore' : 'winMaximize'} />
      </button>
      <button
        type="button"
        className="wincontrols__btn wincontrols__btn--close"
        title="닫기"
        onClick={run('close')}
      >
        <Icon name="close" />
      </button>
    </div>
  )
}
