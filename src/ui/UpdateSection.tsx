/** 설정 맨 위에 놓이는 판올림 칸.
 *
 *  설정을 열면 알아서 한 번 확인한다. 새 판이 없으면 조용히 지금 버전만 보여 주고,
 *  있으면 그때만 눈에 띄게 바뀐다 — 평소에는 아무것도 요구하지 않아야 한다.
 *
 *  확인이 실패해도 설정 창을 쓰는 데는 아무 지장이 없어야 하므로, 실패는 한 줄로만 알린다
 *  (인터넷이 없거나 아직 릴리스가 하나도 없을 때가 대부분이다). */
import { useEffect, useState } from 'react'
import { checkForUpdate, currentVersion, installUpdate, type UpdateInfo } from '../platform/updater'
import { isTauri } from '../platform/env'
import { notify } from './toast'
import { Icon } from './Icon'
import { t, useT } from '../i18n'

type Phase =
  | { at: 'checking' }
  | { at: 'latest' }
  | { at: 'found'; info: UpdateInfo }
  | { at: 'downloading'; info: UpdateInfo; percent: number | null }
  | { at: 'failed'; why: string }

export function UpdateSection() {
  const [version, setVersion] = useState('')
  const say = useT()
  const [phase, setPhase] = useState<Phase>({ at: 'checking' })

  useEffect(() => {
    void currentVersion().then(setVersion)
  }, [])

  const check = async () => {
    setPhase({ at: 'checking' })
    try {
      const info = await checkForUpdate()
      setPhase(info ? { at: 'found', info } : { at: 'latest' })
    } catch (err) {
      setPhase({ at: 'failed', why: err instanceof Error ? err.message : String(err) })
    }
  }

  // 설정을 열 때 한 번. 사용자가 따로 누르지 않아도 알게 하려는 것이므로 조용히 돈다.
  useEffect(() => {
    if (!isTauri()) {
      setPhase({ at: 'failed', why: t('update.browser') })
      return
    }
    void check()
  }, [])

  const install = async (info: UpdateInfo) => {
    setPhase({ at: 'downloading', info, percent: null })
    try {
      await installUpdate(({ downloaded, total }) => {
        setPhase({
          at: 'downloading',
          info,
          percent: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
        })
      })
      // 여기까지 오면 앱이 곧 다시 뜬다. 혹시 안 뜨면 아래 안내가 남는다.
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      setPhase({ at: 'found', info })
      notify(t('update.failed', { reason: why }))
    }
  }

  const isNew = phase.at === 'found' || phase.at === 'downloading'

  return (
    <section className={`settings__section update${isNew ? ' update--new' : ''}`}>
      <h2 className="settings__title">{say('update.title')}</h2>

      <div className="update__row">
        <span className="update__now">
          {say('update.current')} <b>{version || '…'}</b>
        </span>

        {phase.at === 'found' && (
          <button className="btn update__go" onClick={() => void install(phase.info)}>
            <Icon name="download" /> {say('update.install', { version: phase.info.version })}
          </button>
        )}

        {(phase.at === 'latest' || phase.at === 'failed') && (
          <button className="btn" onClick={() => void check()}>
            {say('update.recheck')}
          </button>
        )}
      </div>

      {phase.at === 'checking' && <p className="settings__note">{say('update.checking')}</p>}
      {phase.at === 'latest' && <p className="settings__note">{say('update.latest')}</p>}
      {phase.at === 'failed' && <p className="settings__note">{phase.why}</p>}

      {phase.at === 'found' && (
        <>
          <p className="settings__note">
            {say('update.found', {
              version: phase.info.date
                ? `${phase.info.version} (${phase.info.date.slice(0, 10)})`
                : phase.info.version,
            })}
          </p>
          {phase.info.notes && <pre className="update__notes">{phase.info.notes}</pre>}
        </>
      )}

      {phase.at === 'downloading' && (
        <>
          <p className="settings__note">
            {phase.percent === null ? say('update.downloading') : say('update.downloadingPercent', { percent: phase.percent })}
          </p>
          <div className="update__bar">
            <div
              className="update__fill"
              style={{ width: phase.percent === null ? '100%' : `${phase.percent}%` }}
            />
          </div>
        </>
      )}
    </section>
  )
}
