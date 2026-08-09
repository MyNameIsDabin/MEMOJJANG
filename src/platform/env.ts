/** Tauri 셸 안에서 도는지, 그냥 브라우저(`npm run dev`)인지 구분한다.
 *  브라우저에서도 UI 개발이 되도록 storage 계층이 이 값을 보고 갈라진다. */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
