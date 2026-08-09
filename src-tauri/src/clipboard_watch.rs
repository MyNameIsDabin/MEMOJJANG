//! 클립보드 자동 수집.
//!
//! 프론트에서 폴링하지 않고 여기서 도는 이유는 두 가지다.
//! 1. 큰 스크린샷을 매 초 IPC 로 넘기면 웹뷰가 멈춘다.
//! 2. Windows 는 클립보드를 열지 않고도 변경 여부만 알아낼 수 있는
//!    `GetClipboardSequenceNumber` 를 준다. 이걸 쓰면 감시 비용이 사실상 0 이다.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager};

/// 설정에서 켜고 끄는 스위치. 스레드는 항상 돌지만 꺼져 있으면 아무것도 모으지 않는다.
static ENABLED: AtomicBool = AtomicBool::new(false);

const POLL_INTERVAL: Duration = Duration::from_millis(700);
/// 클립보드에 실수로 들어온 거대한 이미지로 디스크를 채우지 않도록 상한을 둔다.
const MAX_PIXELS: usize = 40_000_000;

pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind")]
enum ClipPayload {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        file: String,
        width: u32,
        height: u32,
    },
}

#[cfg(windows)]
fn clipboard_revision() -> u64 {
    // 읽기 전용 카운터라 클립보드를 잠그지 않는다.
    unsafe { windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber() as u64 }
}

#[cfg(not(windows))]
fn clipboard_revision() -> u64 {
    // 시퀀스 번호가 없는 플랫폼에서는 텍스트 해시로 대신한다.
    // 이미지 자동 수집은 Windows 에서만 동작한다.
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let Ok(mut clipboard) = arboard::Clipboard::new() else {
        return 0;
    };
    let Ok(text) = clipboard.get_text() else {
        return 0;
    };
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    hasher.finish()
}

/// 겹치지 않는 파일 이름. 프론트의 storage.saveImage 와 같은 규칙을 따른다.
fn image_file_name() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("clip-{nanos:x}.png")
}

/// 클립보드 이미지를 앱 데이터 폴더에 png 로 남기고 파일 이름을 돌려준다.
fn save_clipboard_image(app: &AppHandle, image: arboard::ImageData) -> Option<ClipPayload> {
    let (width, height) = (image.width, image.height);
    if width == 0 || height == 0 || width.saturating_mul(height) > MAX_PIXELS {
        return None;
    }

    let buffer =
        image::RgbaImage::from_raw(width as u32, height as u32, image.bytes.into_owned())?;

    let dir = app.path().app_data_dir().ok()?.join("images");
    if let Err(err) = std::fs::create_dir_all(&dir) {
        eprintln!("[clipboard] 이미지 폴더를 만들지 못했습니다: {err}");
        return None;
    }

    let name = image_file_name();
    if let Err(err) = buffer.save(dir.join(&name)) {
        eprintln!("[clipboard] 이미지 저장 실패: {err}");
        return None;
    }

    Some(ClipPayload::Image {
        file: name,
        width: width as u32,
        height: height as u32,
    })
}

fn read_clipboard(app: &AppHandle) -> Option<ClipPayload> {
    let mut clipboard = arboard::Clipboard::new().ok()?;

    // 텍스트를 먼저 본다. 엑셀·브라우저처럼 텍스트와 비트맵을 함께 올리는 프로그램이 많은데,
    // 그런 경우 사용자가 원한 것은 대개 글자 쪽이다.
    if let Ok(text) = clipboard.get_text() {
        if !text.trim().is_empty() {
            return Some(ClipPayload::Text { text });
        }
    }

    let image = clipboard.get_image().ok()?;
    save_clipboard_image(app, image)
}

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_revision = clipboard_revision();

        loop {
            std::thread::sleep(POLL_INTERVAL);

            let revision = clipboard_revision();
            let changed = revision != last_revision;
            last_revision = revision;

            // 꺼져 있는 동안의 변경은 흘려보낸다. 다시 켰을 때 예전 내용이
            // 갑자기 쏟아지면 놀라기 때문이다.
            if !ENABLED.load(Ordering::Relaxed) || !changed {
                continue;
            }

            if let Some(payload) = read_clipboard(&app) {
                if let Err(err) = app.emit("memojjang://clipboard", payload) {
                    eprintln!("[clipboard] 알림 전달 실패: {err}");
                }
            }
        }
    });
}
