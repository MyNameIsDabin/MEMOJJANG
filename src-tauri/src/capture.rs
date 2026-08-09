//! 바탕화면 영역 캡처.
//!
//! 다른 캡처 앱들이 하는 것과 같은 방식이다: **먼저 화면을 통째로 찍어 얼려 두고**,
//! 그 그림을 창에 띄운 뒤 그 위에서 영역을 고르게 한다. 얼리지 않고 투명한 창을 덮으면
//! 고르는 동안 화면이 계속 움직여 무엇을 잡는 중인지 알기 어렵고, 어둡게 깐 막까지
//! 사진에 함께 찍힐 위험이 있다.
//!
//! 메모짱 창은 숨기지 않는다. 잠깐 사라졌다 나타나면 눈에 거슬리고, 메모짱까지 담고 싶을
//! 때도 있기 때문이다. 대신 얼린 그림에 메모짱이 그대로 들어 있으니 원하면 그 자리도 담을 수 있다.
//!
//! 찍은 원본은 여기 그대로 들고 있고 화면에는 JPEG 미리보기만 건넨다. 모니터 두 대를
//! 아우르면 800만 화소가 넘는데, 그걸 무손실로 만들어 IPC 로 넘기면 몇 초가 걸린다.
//! 정작 노트에 들어갈 조각은 원본에서 오려 내므로 화질은 하나도 잃지 않는다.

use std::sync::Mutex;

use base64::Engine;
use tauri::{PhysicalPosition, PhysicalSize};

/// 얼려 둔 화면 원본(RGBA)과 그 크기.
struct Frame {
    bytes: Vec<u8>,
    width: i32,
    height: i32,
}

static FRAME: Mutex<Option<Frame>> = Mutex::new(None);
/// 캡처를 시작하기 전의 창 자리. 끝나면 여기로 되돌린다.
static PREVIOUS: Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>> = Mutex::new(None);

#[derive(serde::Serialize)]
pub struct Shot {
    /// 고를 때 보여 줄 미리보기 (jpeg, base64)
    preview: String,
    /// 가상 화면(모니터 전체를 아우르는 사각형)의 크기 — 물리 픽셀
    width: i32,
    height: i32,
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT,
        DIB_RGB_COLORS, SRCCOPY,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN,
    };

    pub fn virtual_screen() -> (i32, i32, i32, i32) {
        unsafe {
            (
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            )
        }
    }

    /// 화면의 한 조각을 RGBA 바이트로 가져온다.
    pub fn grab(x: i32, y: i32, width: i32, height: i32) -> Result<Vec<u8>, String> {
        if width <= 0 || height <= 0 {
            return Err("캡처할 크기가 없습니다.".into());
        }

        unsafe {
            let screen = GetDC(0 as HWND);
            if screen.is_null() {
                return Err("화면을 열지 못했습니다.".into());
            }
            let mem = CreateCompatibleDC(screen);
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            let old = SelectObject(mem, bitmap as _);

            // CAPTUREBLT 를 함께 줘야 레이어드 창(둥근 모서리·그림자 같은 것)도 담긴다.
            let ok = BitBlt(mem, 0, 0, width, height, screen, x, y, SRCCOPY | CAPTUREBLT);

            let mut info: BITMAPINFO = std::mem::zeroed();
            info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            info.bmiHeader.biWidth = width;
            // 음수 높이 = 위에서 아래로. 기본값(아래에서 위로)이면 그림이 뒤집힌다.
            info.bmiHeader.biHeight = -height;
            info.bmiHeader.biPlanes = 1;
            info.bmiHeader.biBitCount = 32;
            info.bmiHeader.biCompression = BI_RGB as u32;

            let mut buffer = vec![0u8; (width as usize) * (height as usize) * 4];
            let lines = GetDIBits(
                mem,
                bitmap,
                0,
                height as u32,
                buffer.as_mut_ptr() as *mut _,
                &mut info,
                DIB_RGB_COLORS,
            );

            SelectObject(mem, old);
            DeleteObject(bitmap as _);
            DeleteDC(mem);
            ReleaseDC(0 as HWND, screen);

            if ok == 0 || lines == 0 {
                return Err("화면을 읽지 못했습니다.".into());
            }

            // GDI 는 BGRA 로 준다. 알파는 0 으로 오므로 불투명하게 채워 준다.
            for px in buffer.chunks_exact_mut(4) {
                px.swap(0, 2);
                px[3] = 255;
            }
            Ok(buffer)
        }
    }
}

#[cfg(not(windows))]
mod win {
    pub fn virtual_screen() -> (i32, i32, i32, i32) {
        (0, 0, 0, 0)
    }
    pub fn grab(_x: i32, _y: i32, _w: i32, _h: i32) -> Result<Vec<u8>, String> {
        Err("이 운영체제에서는 아직 화면 캡처를 지원하지 않습니다.".into())
    }
}

fn encode(bytes: &[u8], width: u32, height: u32, format: image::ImageFormat) -> Result<Vec<u8>, String> {
    let image = image::RgbaImage::from_raw(width, height, bytes.to_vec())
        .ok_or_else(|| "그림을 만들지 못했습니다.".to_string())?;
    let mut out = std::io::Cursor::new(Vec::new());
    match format {
        // JPEG 는 알파를 모르므로 RGB 로 낮춰 넘긴다. 미리보기라 이걸로 충분하다.
        image::ImageFormat::Jpeg => image::DynamicImage::ImageRgba8(image)
            .to_rgb8()
            .write_to(&mut out, format),
        _ => image.write_to(&mut out, format),
    }
    .map_err(|e| format!("그림을 저장하지 못했습니다: {e}"))?;
    Ok(out.into_inner())
}

/// 화면을 찍어 얼려 두고, 그 그림을 덮어 그릴 수 있도록 창을 가상 화면 전체로 넓힌다.
#[tauri::command]
pub fn begin_capture(window: tauri::Window) -> Result<Shot, String> {
    // set_size 는 **안쪽** 크기를 정하므로 잴 때도 안쪽으로 재야 한다.
    // 바깥 크기를 재어 두고 그대로 되돌리면 테두리만큼 창이 조금씩 커진다.
    let previous = (
        window.outer_position().map_err(|e| e.to_string())?,
        window.inner_size().map_err(|e| e.to_string())?,
    );
    *PREVIOUS.lock().unwrap() = Some(previous);

    let restore = |window: &tauri::Window| {
        let _ = window.set_position(previous.0);
        let _ = window.set_size(previous.1);
        let _ = window.set_focus();
    };

    let (x, y, width, height) = win::virtual_screen();
    let bytes = match win::grab(x, y, width, height) {
        Ok(bytes) => bytes,
        Err(err) => {
            // 실패해도 창은 반드시 돌려놓는다. 안 그러면 앱이 사라진 것처럼 보인다.
            restore(&window);
            return Err(err);
        }
    };

    let preview = match encode(&bytes, width as u32, height as u32, image::ImageFormat::Jpeg) {
        Ok(preview) => preview,
        Err(err) => {
            restore(&window);
            return Err(err);
        }
    };

    *FRAME.lock().unwrap() = Some(Frame { bytes, width, height });

    let _ = window.set_always_on_top(true);
    let _ = window.set_position(PhysicalPosition::new(x, y));
    let _ = window.set_size(PhysicalSize::new(width as u32, height as u32));
    let _ = window.set_focus();

    Ok(Shot {
        preview: base64::engine::general_purpose::STANDARD.encode(preview),
        width,
        height,
    })
}

/// 얼려 둔 원본에서 고른 자리만 오려 낸다. 좌표는 물리 픽셀.
#[tauri::command]
pub fn crop_capture(x: i32, y: i32, width: i32, height: i32) -> Result<String, String> {
    let guard = FRAME.lock().unwrap();
    let frame = guard.as_ref().ok_or_else(|| "얼려 둔 화면이 없습니다.".to_string())?;

    // 화면 밖으로 나간 자리를 잘라 낸다. 끄는 동안 창 밖으로 나갈 수 있다.
    let left = x.clamp(0, frame.width);
    let top = y.clamp(0, frame.height);
    let right = (x + width).clamp(0, frame.width);
    let bottom = (y + height).clamp(0, frame.height);
    let w = right - left;
    let h = bottom - top;
    if w <= 0 || h <= 0 {
        return Err("고른 자리가 화면 밖입니다.".into());
    }

    let mut out = Vec::with_capacity((w * h * 4) as usize);
    for row in top..bottom {
        let from = ((row * frame.width + left) * 4) as usize;
        let to = from + (w * 4) as usize;
        out.extend_from_slice(&frame.bytes[from..to]);
    }

    let png = encode(&out, w as u32, h as u32, image::ImageFormat::Png)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(png))
}

/// 캡처를 마치고 창을 원래 자리로 되돌린다.
#[tauri::command]
pub fn end_capture(window: tauri::Window, always_on_top: bool) -> Result<(), String> {
    // 원본은 꽤 무겁다(모니터 두 대면 30MB 가 넘는다). 끝나는 즉시 놓아 준다.
    *FRAME.lock().unwrap() = None;

    if let Some((position, size)) = PREVIOUS.lock().unwrap().take() {
        let _ = window.set_position(position);
        let _ = window.set_size(size);
    }
    // 캡처 때문에 잠시 올려 뒀던 것을 사용자가 정해 둔 값으로 되돌린다.
    let _ = window.set_always_on_top(always_on_top);
    let _ = window.set_focus();
    Ok(())
}
