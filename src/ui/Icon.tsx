/** 손으로 그린 픽셀 아이콘.
 *
 *  이모지를 쓰면 글꼴마다·운영체제마다 모양이 달라지고, 무엇보다 매끈한 컬러 그림이라
 *  이 앱의 도트 느낌과 따로 논다. 그래서 16×16 격자 위에 직사각형만으로 직접 그렸다.
 *
 *  규칙 두 가지:
 *  - 좌표는 전부 정수. `shape-rendering: crispEdges` 와 만나 픽셀이 뭉개지지 않는다.
 *  - 채우기는 evenodd 라 겹친 사각형은 서로를 지운다. 구멍을 낼 때는 그 성질을 쓰고,
 *    아닐 때는 애초에 겹치지 않게 그린다.
 */

export type IconName =
  | 'mark'
  | 'fit'
  | 'grid'
  | 'snap'
  | 'settings'
  | 'more'
  | 'pin'
  | 'pencil'
  | 'close'
  | 'collapse'
  | 'plus'
  | 'folder'
  | 'search'
  | 'grip'
  | 'clock'
  | 'undo'
  | 'expand'
  | 'shrink'
  | 'download'
  | 'sticker'
  | 'link'
  | 'layers'
  | 'trash'
  | 'winMinimize'
  | 'winMaximize'
  | 'winRestore'

const PATHS: Record<IconName, string> = {
  // 테두리 안에 글줄이 든 메모 한 장
  mark: 'M2,2h12v12h-12zM4,4h8v8h-8zM5,6h6v1h-6zM5,8h6v1h-6zM5,10h4v1h-4z',

  // 화면 테두리 안에 내용이 쏙 들어간 모습 — 전부 보이게 맞춘다.
  // 꺾쇠 넉 장으로 그렸더니 작은 크기에서 점선 원처럼 보여 이쪽으로 바꿨다.
  fit: 'M1,2h14v12h-14zM3,4h10v8h-10zM5,6h6v4h-6z',

  // 네모 넉 장을 가지런히 — 격자로 정리
  grid: 'M2,2h5v5h-5zM9,2h5v5h-5zM2,9h5v5h-5zM9,9h5v5h-5z',

  // 격자선 위에 네모가 딱 맞물린 모습 — 격자에 붙이기
  snap: 'M7,1h1v14h-1zM1,7h14v1h-14zM2,2h5v5h-5z',

  // 손잡이 달린 조절기 두 줄 — 톱니는 16px 에서 뭉개져서 이쪽이 훨씬 잘 읽힌다
  settings: 'M2,3h8v2h-8zM10,2h4v4h-4zM2,9h4v4h-4zM6,10h8v2h-8z',

  more: 'M2,7h2v2h-2zM7,7h2v2h-2zM12,7h2v2h-2z',

  // 압정 — 머리, 챙, 바늘
  pin: 'M6,2h4v5h-4zM4,7h8v2h-8zM7,9h2v5h-2z',

  // 오른쪽 위가 굵고 왼쪽 아래로 갈수록 뾰족해지는 연필.
  // 계단마다 정확히 블록 크기만큼 내려가야 서로 겹치지 않는다.
  pencil: 'M10,1h4v4h-4zM8,5h3v3h-3zM5,8h3v3h-3zM2,11h3v3h-3z',

  // 가운데 칸은 두 대각선이 함께 쓰므로 한 번만 그린다
  close: 'M3,3h2v2h-2zM5,5h2v2h-2zM7,7h2v2h-2zM9,9h2v2h-2zM11,11h2v2h-2zM11,3h2v2h-2zM9,5h2v2h-2zM5,9h2v2h-2zM3,11h2v2h-2z',

  collapse: 'M3,7h10v2h-10z',

  // 자기 자신과 겹치지 않도록 한 붓으로 그린 십자
  plus: 'M7,3h2v4h4v2h-4v4h-2v-4h-4v-2h4z',

  folder: 'M2,3h5v2h7v9h-12z',

  // 돋보기 — 테를 evenodd 로 비우고, 손잡이는 테에 닿기만 하고 겹치지 않게
  search: 'M1,1h9v9h-9zM3,3h5v5h-5zM10,10h2v2h-2zM12,12h3v3h-3z',

  // 점 여섯 — 잡고 끌라는 표시
  grip: 'M5,3h2v2h-2zM9,3h2v2h-2zM5,7h2v2h-2zM9,7h2v2h-2zM5,11h2v2h-2zM9,11h2v2h-2z',

  // 테를 evenodd 로 비우고, 그 안쪽에 바늘 둘을 그린다
  clock: 'M2,2h12v12h-12zM4,4h8v8h-8zM7,5h1v4h-1zM8,8h3v1h-3z',

  // 왼쪽으로 되돌아가는 화살표 — 기본값으로 돌리기
  undo: 'M4,7h7v2h-7zM2,7h2v2h-2zM4,5h2v2h-2zM4,9h2v2h-2zM9,9h2v4h-2z',

  // 네 귀퉁이로 뻗는 화살촉 — 화면 가득 펼치기.
  // 대각선 대신 귀퉁이 꺾쇠로 그려야 16px 에서 뭉개지지 않는다.
  expand: 'M1,1h6v2h-4v4h-2zM9,1h6v6h-2v-4h-4zM1,9h2v4h4v2h-6zM13,9h2v6h-6v-2h4z',

  // 안쪽으로 모이는 꺾쇠 — 원래 크기로
  shrink: 'M5,1h2v6h-6v-2h4zM9,1h2v4h4v2h-6zM1,9h6v6h-2v-4h-4zM9,9h6v2h-4v4h-2z',

  // 아래로 향한 화살표와 받침 — 내려받기.
  // 화살촉은 대각선 대신 한 칸씩 좁아지는 계단으로 그린다(위 규칙).
  download: 'M7,2h2v6h-2zM4,8h8v1h-8zM5,9h6v1h-6zM6,10h4v1h-4zM7,11h2v1h-2zM2,13h12v2h-12z',

  // 한 귀퉁이가 접힌 종이 — 붙이는 스티커.
  // 접힌 자리는 계단으로 파낸다(대각선을 쓰지 않는 규칙).
  sticker:
    'M2,1h12v8h-5v5h-7zM4,3h8v1h-8zM4,5h8v1h-8zM4,7h4v1h-4zM10,10h3v1h-2v1h-1zM10,12h1v1h-1z',

  // 고리 두 개가 맞물린 사슬 — 노트에 붙여 두기
  link: 'M2,6h5v1h-4v2h4v1h-5zM9,6h5v4h-5v-1h4v-2h-4zM6,7h4v2h-4z',

  // 겹쳐 놓은 두 장 — 앞뒤 순서 바꾸기
  layers: 'M1,3h10v4h-10zM5,9h10v4h-10z',

  // 뚜껑과 몸통 — 보관함에서 빼기
  trash: 'M6,1h4v2h-4zM2,3h12v2h-12zM4,6h8v9h-8zM6,8h1v5h-1zM9,8h1v5h-1z',

  winMinimize: 'M3,8h10v1h-10z',
  winMaximize: 'M3,3h10v10h-10zM4,4h8v8h-8z',
  winRestore: 'M2,5h9v9h-9zM3,6h7v7h-7zM5,2h9v2h-9zM12,4h2v7h-2z',
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
