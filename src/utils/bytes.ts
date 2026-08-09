/** 바이트와 base64 사이를 오간다.
 *  Rust 쪽과 그림을 주고받을 때, 그리고 브라우저 모드에서 localStorage 에 담을 때 쓴다. */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  // 한 번에 넘기면 인자가 너무 많아 스택이 넘친다. 잘라서 이어 붙인다.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function base64ToBlob(base64: string, mime: string): Blob {
  return new Blob([base64ToBytes(base64) as BlobPart], { type: mime })
}
