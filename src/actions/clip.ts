/** 메모지 자체를 복사·붙여넣기.
 *
 *  안쪽 글자가 아니라 **노트 한 장을 통째로** 옮긴다. 같은 캔버스에서 복제할 수도 있고
 *  다른 탭에 붙일 수도 있다.
 *
 *  실어 나르는 곳은 시스템 클립보드다. 앱 안에만 담아 두면 창을 닫는 순간 사라지는데,
 *  클립보드에 두면 탭을 옮겨 다녀도, 앱을 다시 켜도 그대로 있다. 붙여넣을 때 우리 표식이
 *  보이면 노트로 되살리고, 아니면 평소대로 글자로 다룬다.
 *
 *  그림은 바이트를 클립보드에 싣지 않는다. 스크린샷 몇 장이면 수십 MB가 되기 때문이다.
 *  대신 어느 캔버스에서 왔는지를 적어 두고, 붙여넣을 때 그 파일을 새 캔버스로 복사해 온다. */
import { newId, type ImageNote, type Note, type Sticker } from '../types'
import { useBoard } from '../store/boardStore'
import { useCanvases } from '../store/canvasStore'
import { copyText } from '../platform/clipboard'
import { canvasImageUrl } from '../platform/canvasFile'
import { saveImage } from '../platform/assets'
import { describeError, notify } from '../ui/toast'

const FORMAT = 'memojjang/notes@1'

interface Clip {
  format: typeof FORMAT
  /** 그림이 딸려 있을 때 그것을 찾아올 캔버스 */
  source: string | null
  notes: Note[]
  /** 그 노트들에 붙어 있던 스티커 */
  stickers: Sticker[]
}

/** 붙여넣은 글이 우리 노트 꾸러미인가. 값싸게 먼저 걸러 낸다. */
export function isNoteClip(text: string): boolean {
  return text.trimStart().startsWith('{') && text.includes(FORMAT)
}

function parse(text: string): Clip | null {
  try {
    const clip = JSON.parse(text) as Clip
    return clip?.format === FORMAT && Array.isArray(clip.notes) ? clip : null
  } catch {
    return null
  }
}

/** 고른 노트를 클립보드에 담는다. 붙어 있던 스티커도 함께 간다. */
export async function copyNotes(ids: string[]): Promise<void> {
  const { notes, stickers, stickerIds } = useBoard.getState()
  const picked = ids.map((id) => notes[id]).filter(Boolean)
  if (!picked.length) return

  const mine = new Set(picked.map((n) => n.id))
  const clip: Clip = {
    format: FORMAT,
    source: useCanvases.getState().activePath(),
    notes: picked,
    stickers: stickerIds
      .map((id) => stickers[id])
      .filter((s): s is Sticker => Boolean(s?.noteId && mine.has(s.noteId))),
  }

  try {
    await copyText(JSON.stringify(clip))
    notify(picked.length === 1 ? '메모지를 복사했습니다.' : `메모지 ${picked.length}장을 복사했습니다.`)
  } catch (err) {
    notify(`복사하지 못했습니다 — ${describeError(err)}`, 'error')
  }
}

/** 그림을 지금 캔버스로 데려온다. 원본이 다른 캔버스에 있으면 파일을 복사해 온다. */
async function bringImage(note: ImageNote, source: string | null): Promise<string | null> {
  const here = useCanvases.getState().activePath()
  if (!source || source === here) return note.file

  const url = await canvasImageUrl(source, note.file).catch(() => null)
  if (!url) return null
  const blob = await (await fetch(url)).blob()
  return saveImage(new Uint8Array(await blob.arrayBuffer()), blob.type || 'image/png')
}

/** 클립보드의 노트 꾸러미를 이 자리에 붙인다. 우리 것이 아니면 false. */
export async function pasteNotes(text: string, world: { x: number; y: number }): Promise<boolean> {
  const clip = parse(text)
  if (!clip || !clip.notes.length) return false

  // 여러 장이면 서로의 자리 관계를 지켜야 한다. 맨 왼쪽 위를 기준으로 통째로 옮긴다.
  const left = Math.min(...clip.notes.map((n) => n.x))
  const top = Math.min(...clip.notes.map((n) => n.y))
  const dx = Math.round(world.x - left)
  const dy = Math.round(world.y - top)

  const board = useBoard.getState()
  board.commit()

  const now = Date.now()
  /** 옛 id -> 새 id. 스티커가 어느 노트에 붙어 있었는지 다시 이어 주려면 필요하다. */
  const remap = new Map<string, string>()
  const fresh: Note[] = []

  for (const note of clip.notes) {
    const id = newId()
    remap.set(note.id, id)

    let copied: Note = { ...note, id, x: note.x + dx, y: note.y + dy, createdAt: now, updatedAt: now }
    if (copied.kind === 'image') {
      const file = await bringImage(copied, clip.source)
      // 그림을 못 가져오면 노트만 남긴다 — 자리는 그대로 두고 "찾을 수 없음" 을 보여 준다.
      copied = { ...copied, file: file ?? copied.file }
    }
    fresh.push(copied)
  }

  const freshStickers: Sticker[] = clip.stickers
    .filter((s) => s.noteId && remap.has(s.noteId))
    .map((s) => ({ ...s, id: newId(), noteId: remap.get(s.noteId as string) as string }))

  useBoard.setState((s) => {
    const notes = { ...s.notes }
    const stickers = { ...s.stickers }
    // 붙인 것이 맨 위로 오도록 z 를 이어서 매긴다.
    let z = s.noteIds.reduce((max, id) => Math.max(max, s.notes[id]?.z ?? 0), 0)
    for (const note of fresh) notes[note.id] = { ...note, z: ++z }
    for (const sticker of freshStickers) stickers[sticker.id] = sticker
    return {
      notes,
      stickers,
      noteIds: [...s.noteIds, ...fresh.map((n) => n.id)],
      stickerIds: [...s.stickerIds, ...freshStickers.map((k) => k.id)],
      selection: fresh.map((n) => n.id),
    }
  })

  return true
}
