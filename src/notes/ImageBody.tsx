/** 붙여넣은 그림 한 장. 스크린샷을 잠깐 얹어두는 자리다. */
import { useEffect, useState } from 'react'
import type { ImageNote } from '../types'
import { imageChromeHeight, useBoard } from '../store/boardStore'
import { imageUrl } from '../platform/assets'
import { copyImageFromUrl } from '../platform/clipboard'

export function ImageBody({ note }: { note: ImageNote }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setMissing(false)
    imageUrl(note.file).then((resolved) => {
      if (!alive) return
      if (resolved) setUrl(resolved)
      else setMissing(true)
    })
    return () => {
      alive = false
    }
  }, [note.file])

  const onCopy = async () => {
    if (!url) return
    await copyImageFromUrl(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  /** 원본 비율로 되돌린다. 늘렸다가 찌그러졌을 때 쓴다. */
  const fitToImage = () => {
    if (!note.naturalW || !note.naturalH) return
    const height = Math.round((note.w * note.naturalH) / note.naturalW) + imageChromeHeight()
    useBoard.getState().resizeNote(note.id, note.w, height)
  }

  return (
    <div className="imagenote">
      <div className="imagenote__frame">
        {missing ? (
          <div className="imagenote__missing">
            그림 파일을 찾을 수 없습니다.
            <br />
            캔버스 파일만 옮기고 <b>.assets</b> 폴더를 두고 오지 않았는지 확인해 보세요.
          </div>
        ) : url ? (
          <img src={url} alt={note.title} draggable={false} />
        ) : null}
      </div>
      <div className="imagenote__foot">
        <button type="button" className="imagenote__act" onClick={fitToImage} title="원본 비율로 맞추기">
          {note.naturalW}×{note.naturalH}
        </button>
        <button type="button" className="imagenote__act" onClick={onCopy} disabled={!url}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
    </div>
  )
}
