//! 한 번에 두 모습으로 클립보드에 올리기.
//!
//! 그림 노트를 `Ctrl+C` 하면 두 곳으로 갈 수 있어야 한다.
//! - 다른 프로그램(메신저·문서)에 붙일 때는 **그림**이어야 하고,
//! - 메모짱 안에 붙일 때는 자리·크기·획까지 살아 있는 **노트 꾸러미**여야 한다.
//!
//! 클립보드 플러그인의 `writeText`/`writeImage` 는 부를 때마다 클립보드를 비우고 다시 채운다.
//! 그래서 두 번 부르면 나중 것만 남는다. 윈도우 클립보드는 원래 **한 번 열어 여러 모습**을
//! 함께 담을 수 있으니, 그 자리를 직접 쓴다.
//!
//! 담는 모습은 셋이다.
//! - `CF_DIBV5` — 그림판·한글처럼 오래된 프로그램이 찾는 것. 윈도우가 이걸로부터
//!   `CF_DIB`·`CF_BITMAP` 을 알아서 만들어 주므로 하나만 넣어도 대부분 붙는다.
//! - `PNG` — 크롬·디스코드처럼 요즘 프로그램이 먼저 찾는 것. 투명도가 그대로 산다.
//! - `CF_UNICODETEXT` — 우리 노트 꾸러미. 다른 프로그램에 붙이면 그저 긴 JSON 이지만,
//!   그림을 먼저 찾는 프로그램에서는 여기까지 오지 않는다.

#[cfg(windows)]
use base64::{engine::general_purpose::STANDARD, Engine as _};

/// 그림과 노트 꾸러미를 클립보드에 함께 올린다.
#[tauri::command]
pub fn copy_note_with_image(text: String, base64_png: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let png = STANDARD
            .decode(&base64_png)
            .map_err(|err| format!("이미지 데이터를 해석하지 못했습니다: {err}"))?;
        windows_impl::write(&text, &png)
    }
    #[cfg(not(windows))]
    {
        let _ = (text, base64_png);
        // 부르는 쪽이 이걸 보고 예전처럼 글만 올리는 길로 되돌아간다.
        Err("이 플랫폼에서는 한 번에 두 모습으로 올릴 수 없습니다".into())
    }
}

#[cfg(windows)]
mod windows_impl {
    use windows_sys::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };

    const CF_UNICODETEXT: u32 = 13;
    const CF_DIBV5: u32 = 17;

    /// 어느 바이트가 무슨 색인지 마스크로 알려 준다는 뜻. 마스크는 헤더 안에 함께 적는다.
    const BI_BITFIELDS: u32 = 3;
    /// 'sRGB' 를 리틀엔디언 4바이트로 적은 것. 색이 프로그램마다 달라 보이지 않게 한다.
    const LCS_SRGB: u32 = 0x7352_4742;
    const LCS_GM_IMAGES: u32 = 4;
    /// 96 DPI. 붙인 그림이 원래 크기로 나오게 한다.
    const PELS_PER_METER: i32 = 2835;

    /// 클립보드를 열어 준 뒤 반드시 닫도록 붙잡아 두는 손잡이.
    struct Board;

    impl Board {
        fn open() -> Result<Self, String> {
            // 창을 넘기지 않아도 된다. 지금 스레드가 임자가 된다.
            if unsafe { OpenClipboard(std::ptr::null_mut()) } == 0 {
                return Err("클립보드를 열지 못했습니다".into());
            }
            Ok(Board)
        }
    }

    impl Drop for Board {
        fn drop(&mut self) {
            unsafe { CloseClipboard() };
        }
    }

    /// 바이트를 클립보드가 가져갈 수 있는 전역 메모리에 옮겨 담는다.
    ///
    /// 성공하면 그 메모리의 임자는 클립보드다 — 우리가 풀면 안 된다.
    /// 실패했을 때만 우리가 되돌린다.
    fn put(format: u32, bytes: &[u8]) -> Result<(), String> {
        let handle: HGLOBAL = unsafe { GlobalAlloc(GMEM_MOVEABLE, bytes.len()) };
        if handle.is_null() {
            return Err("클립보드에 쓸 메모리를 얻지 못했습니다".into());
        }

        let ptr = unsafe { GlobalLock(handle) };
        if ptr.is_null() {
            unsafe { GlobalFree(handle) };
            return Err("클립보드 메모리를 잠그지 못했습니다".into());
        }
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr as *mut u8, bytes.len());
            GlobalUnlock(handle);
        }

        if unsafe { SetClipboardData(format, handle as HANDLE) }.is_null() {
            unsafe { GlobalFree(handle) };
            return Err("클립보드에 담지 못했습니다".into());
        }
        Ok(())
    }

    /// 헤더는 정해진 차례대로 붙이기만 하면 된다. 자리를 하나라도 어기면 통째로 못 읽는다.
    fn u32s(dib: &mut Vec<u8>, values: &[u32]) {
        for v in values {
            dib.extend_from_slice(&v.to_le_bytes());
        }
    }

    /// PNG 를 윈도우가 아는 그림(BITMAPV5HEADER + BGRA)으로 굽는다.
    pub(super) fn to_dib_v5(png: &[u8]) -> Result<Vec<u8>, String> {
        let image = image::load_from_memory_with_format(png, image::ImageFormat::Png)
            .map_err(|err| format!("이미지를 읽지 못했습니다: {err}"))?
            .to_rgba8();
        let (width, height) = (image.width(), image.height());
        if width == 0 || height == 0 {
            return Err("빈 이미지입니다".into());
        }

        let pixels = (width as usize) * (height as usize) * 4;
        let mut dib = Vec::with_capacity(124 + pixels);
        u32s(&mut dib, &[124, width, height]); // 크기 / 너비 / 높이
        // 높이가 양수면 아래에서 위로 담는다는 뜻이다. 위에서 아래로 담으면 뒤집어 붙는 곳이 있다.
        dib.extend_from_slice(&1u16.to_le_bytes()); // 면 수
        dib.extend_from_slice(&32u16.to_le_bytes()); // 한 점에 32비트
        u32s(
            &mut dib,
            &[
                BI_BITFIELDS,
                pixels as u32,           // 그림 바이트 수
                PELS_PER_METER as u32,   // 가로 해상도
                PELS_PER_METER as u32,   // 세로 해상도
                0,                       // 쓴 색 수 — 32비트에는 팔레트가 없다
                0,                       // 꼭 필요한 색 수
                0x00FF_0000,             // 빨강
                0x0000_FF00,             // 초록
                0x0000_00FF,             // 파랑
                0xFF00_0000,             // 투명도
                LCS_SRGB,
            ],
        );
        u32s(&mut dib, &[0; 9]); // 색 끝점 — sRGB 를 쓰면 보지 않는다
        u32s(&mut dib, &[0; 3]); // 감마 셋
        u32s(&mut dib, &[LCS_GM_IMAGES, 0, 0, 0]); // 렌더링 의도 / 프로파일 / 예비
        debug_assert_eq!(dib.len(), 124);

        // 아래 줄부터 거꾸로, 색은 BGRA 차례로.
        for y in (0..height).rev() {
            for x in 0..width {
                let [r, g, b, a] = image.get_pixel(x, y).0;
                dib.extend_from_slice(&[b, g, r, a]);
            }
        }
        Ok(dib)
    }

    /// PNG 를 그대로 담을 자리의 이름을 등록한다. 이미 있으면 그 번호를 돌려준다.
    fn png_format() -> u32 {
        let name: Vec<u16> = "PNG\0".encode_utf16().collect();
        unsafe { RegisterClipboardFormatW(name.as_ptr()) }
    }

    pub fn write(text: &str, png: &[u8]) -> Result<(), String> {
        // 클립보드를 비우기 전에 굽는다. 여기서 실패하면 있던 것을 그대로 두는 편이 낫다.
        let dib = to_dib_v5(png)?;
        let mut utf16: Vec<u16> = text.encode_utf16().collect();
        utf16.push(0);
        let utf16_bytes: Vec<u8> = utf16.iter().flat_map(|c| c.to_le_bytes()).collect();

        let _board = Board::open()?;
        if unsafe { EmptyClipboard() } == 0 {
            return Err("클립보드를 비우지 못했습니다".into());
        }

        // 그림이 먼저다. 이게 실패하면 부르는 쪽이 예전 길(글만 올리기)로 되돌아간다.
        put(CF_DIBV5, &dib)?;
        let png_format = png_format();
        if png_format != 0 {
            // 없어도 그림은 붙는다. 되면 더 좋은 정도라 실패해도 넘어간다.
            let _ = put(png_format, png);
        }
        put(CF_UNICODETEXT, &utf16_bytes)
    }
}

#[cfg(all(test, windows))]
mod tests {
    /// 헤더 자리를 하나만 어겨도 붙여넣는 쪽은 아무 말 없이 깨진 그림을 보여 준다.
    /// 그래서 눈으로 확인하기 전에 바이트 몇 개라도 여기서 붙잡는다.
    #[test]
    fn dib_header_and_pixels() {
        // 2x1 png: 왼쪽 빨강, 오른쪽 파랑
        let mut png = Vec::new();
        {
            let mut image = image::RgbaImage::new(2, 1);
            image.put_pixel(0, 0, image::Rgba([255, 0, 0, 255]));
            image.put_pixel(1, 0, image::Rgba([0, 0, 255, 128]));
            image::DynamicImage::ImageRgba8(image)
                .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
                .unwrap();
        }

        let dib = super::windows_impl::to_dib_v5(&png).unwrap();
        assert_eq!(dib.len(), 124 + 2 * 4);
        assert_eq!(&dib[0..4], &124u32.to_le_bytes()); // 헤더 크기
        assert_eq!(&dib[4..8], &2u32.to_le_bytes()); // 너비
        assert_eq!(&dib[8..12], &1u32.to_le_bytes()); // 높이 (양수 = 아래에서 위로)
        assert_eq!(&dib[14..16], &32u16.to_le_bytes()); // 한 점에 32비트
        // 색은 BGRA 차례로 들어간다.
        assert_eq!(&dib[124..128], &[0, 0, 255, 255]);
        assert_eq!(&dib[128..132], &[255, 0, 0, 128]);
    }

    /// 진짜 클립보드에 담아 보고 세 모습이 다 들어갔는지 센다.
    ///
    /// 사람이 쓰던 클립보드를 덮어쓰기 때문에 평소에는 건너뛴다.
    /// 확인할 일이 있으면 `cargo test -- --ignored clipboard_holds` 로 부른다.
    #[test]
    #[ignore]
    fn clipboard_holds_image_and_text() {
        use windows_sys::Win32::System::DataExchange::{
            CloseClipboard, IsClipboardFormatAvailable, OpenClipboard,
        };

        let mut png = Vec::new();
        image::DynamicImage::ImageRgba8(image::RgbaImage::new(3, 2))
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();

        super::windows_impl::write("메모짱 시험", &png).unwrap();

        unsafe {
            assert!(OpenClipboard(std::ptr::null_mut()) != 0);
            // 8 = CF_DIB. 우리는 넣지 않았지만 윈도우가 CF_DIBV5 에서 만들어 준다.
            for format in [17u32, 8, 13] {
                assert!(IsClipboardFormatAvailable(format) != 0, "형식 {format} 이 없습니다");
            }
            CloseClipboard();
        }
    }
}
