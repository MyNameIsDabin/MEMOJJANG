/** 꾸미기 모드에서 우클릭하면 뜨는 스티커 고르기.
 *
 *  채팅 앱의 이모티콘 서랍처럼 그림만 늘어놓는다. 고르면 누른 자리에 붙고 곧바로
 *  손잡이가 달린 상태가 된다 — 붙이자마자 크기와 각도를 잡고 싶기 때문이다.
 *
 *  보관함이 비어 있을 때는 고를 것이 없으므로 담는 자리부터 펼쳐 준다. */
import { useEffect, useRef, useState } from 'react'
import type { StickerAsset } from '../types'
import { useBoard } from '../store/boardStore'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import {
  addStickerAsset,
  exportStickerPack,
  importStickerPack,
  removeStickerAsset,
} from '../platform/stickers'
import { isTauri } from '../platform/env'
import { useStickerUrl } from '../canvas/StickerLayer'
import { notify } from './toast'
import { Icon } from './Icon'
import './stickerpicker.css'

export function StickerPicker({
  screenX,
  screenY,
  world,
  onClose,
}: {
  screenX: number
  screenY: number
  world: { x: number; y: number }
  onClose: () => void
}) {
  const assets = useSettings((s) => s.stickerAssets)
  const ref = useRef<HTMLDivElement>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  /** 내보낼 것을 고르는 중이면 그 id 들. null 이면 평소대로 붙이는 모드. */
  const [picking, setPicking] = useState<string[] | null>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const place = (asset: StickerAsset) => {
    const id = useBoard.getState().addSticker(asset.id, world)
    useUi.getState().pickSticker(id)
    onClose()
  }

  const add = async () => {
    setBusy(true)
    try {
      const asset = await addStickerAsset(name)
      if (asset) {
        const { set, stickerAssets } = useSettings.getState()
        set('stickerAssets', [...stickerAssets, asset])
        setName('')
        setAdding(false)
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const drop = async (asset: StickerAsset) => {
    const { set, stickerAssets } = useSettings.getState()
    set(
      'stickerAssets',
      stickerAssets.filter((a) => a.id !== asset.id),
    )
    await removeStickerAsset(asset)
  }

  const toggle = (assetId: string) =>
    setPicking((cur) =>
      cur === null ? cur : cur.includes(assetId) ? cur.filter((i) => i !== assetId) : [...cur, assetId],
    )

  const sendOut = async () => {
    setBusy(true)
    try {
      const chosen = assets.filter((a) => picking?.includes(a.id))
      const done = await exportStickerPack(chosen)
      if (done) {
        notify(`스티커 ${chosen.length}개를 내보냈습니다.`)
        setPicking(null)
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const bringIn = async () => {
    setBusy(true)
    try {
      const added = await importStickerPack()
      if (added.length) {
        const { set, stickerAssets } = useSettings.getState()
        set('stickerAssets', [...stickerAssets, ...added])
        notify(`스티커 ${added.length}개를 보관함에 담았습니다.`)
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const empty = assets.length === 0

  return (
    <div
      className="stpicker bevel-out"
      ref={ref}
      style={{ left: screenX, top: screenY }}
      role="dialog"
      aria-label="스티커 고르기"
    >
      {empty ? (
        <p className="stpicker__empty">보관함이 비어 있습니다. 그림을 담거나 꾸러미를 불러오세요.</p>
      ) : (
        <div className="stpicker__grid">
          {assets.map((asset) => (
            <Tile
              key={asset.id}
              asset={asset}
              picking={picking !== null}
              chosen={Boolean(picking?.includes(asset.id))}
              onPick={() => (picking === null ? place(asset) : toggle(asset.id))}
              onDrop={() => void drop(asset)}
            />
          ))}
        </div>
      )}

      {picking !== null && (
        <div className="stpicker__foot">
          <button
            className="btn stpicker__small"
            onClick={() => setPicking(picking.length === assets.length ? [] : assets.map((a) => a.id))}
          >
            {picking.length === assets.length ? '모두 끄기' : '모두 고르기'}
          </button>
          <button className="btn stpicker__small" disabled={!picking.length || busy} onClick={() => void sendOut()}>
            {picking.length}개 내보내기
          </button>
          <button className="btn stpicker__small" onClick={() => setPicking(null)}>
            취소
          </button>
        </div>
      )}

      {adding || empty ? (
        <div className="stpicker__add">
          <input
            className="stpicker__name"
            value={name}
            placeholder="스티커 이름"
            spellCheck={false}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void add()
              }
            }}
          />
          <button className="btn" disabled={!isTauri() || busy} onClick={() => void add()}>
            그림 고르기…
          </button>
        </div>
      ) : (
        picking === null && (
          <div className="stpicker__foot">
            <button className="btn stpicker__small" onClick={() => setAdding(true)}>
              ＋ 담기
            </button>
            <button
              className="btn stpicker__small"
              disabled={empty || busy}
              title="고른 스티커를 그림까지 함께 파일 하나로 내보냅니다"
              onClick={() => setPicking([])}
            >
              내보내기
            </button>
            <button
              className="btn stpicker__small"
              disabled={!isTauri() || busy}
              title="남이 만든 스티커 꾸러미를 보관함에 담습니다"
              onClick={() => void bringIn()}
            >
              불러오기
            </button>
          </div>
        )
      )}
    </div>
  )
}

function Tile({
  asset,
  picking,
  chosen,
  onPick,
  onDrop,
}: {
  asset: StickerAsset
  picking: boolean
  chosen: boolean
  onPick: () => void
  onDrop: () => void
}) {
  const url = useStickerUrl(asset.file)
  return (
    <div className="stpicker__tile">
      <button
        type="button"
        className={`stpicker__pick${chosen ? ' stpicker__pick--on' : ''}`}
        aria-pressed={picking ? chosen : undefined}
        title={picking ? `'${asset.name}' 고르기` : asset.name}
        onClick={onPick}
      >
        {url ? <img src={url} alt={asset.name} draggable={false} /> : <span>{asset.name}</span>}
        {chosen && <span className="stpicker__check">✔</span>}
      </button>
      {/* 고르는 중에는 지우기 단추를 숨긴다 — 내보내려다 지우는 사고를 막는다. */}
      {!picking && (
        <button
          type="button"
          className="stpicker__drop"
          title={`'${asset.name}' 을(를) 보관함에서 빼기`}
          onClick={onDrop}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  )
}
