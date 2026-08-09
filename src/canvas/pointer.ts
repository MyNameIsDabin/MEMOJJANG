/** 마지막 포인터 위치와 "새 노트를 놓을 자리" 계산.
 *
 *  Board.tsx 가 아니라 여기 있는 이유: 컴포넌트 파일이 컴포넌트가 아닌 값을 함께
 *  내보내면 React Fast Refresh 가 그 파일 전체를 다시 불러온다. */
import { toWorld, useBoard } from '../store/boardStore'

/** 캔버스 위 마지막 포인터 위치(화면 좌표). Board 가 갱신한다. */
export const lastPointer = { x: 0, y: 0, inside: false }

/** 커서가 캔버스 위에 있으면 커서 자리, 아니면 화면 한가운데 (월드 좌표). */
export function dropPoint(): { x: number; y: number } {
  const vp = useBoard.getState().viewport
  const screenX = lastPointer.inside ? lastPointer.x : window.innerWidth / 2
  const screenY = lastPointer.inside ? lastPointer.y : window.innerHeight / 2
  return toWorld(vp, screenX, screenY)
}
