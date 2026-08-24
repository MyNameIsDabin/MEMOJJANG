//! 컴퓨터를 켤 때 트레이에 함께 올라오게 하기.
//!
//! 플러그인을 하나 더 붙이지 않고 레지스트리를 직접 만진다. Windows 에서 "로그인할 때 실행"
//! 은 결국 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 에 값 하나를 두는 일이고,
//! 그건 이 파일 몇 줄이면 끝난다. HKCU 라 관리자 권한도 필요 없다.
//!
//! 켜 둔 상태는 여기(레지스트리)가 유일한 정본이다. 설정 파일에도 적어 두면 두 곳이 어긋난다
//! — 사용자가 작업 관리자의 '시작 프로그램' 에서 직접 꺼 버리면 설정 파일만 켜진 채로 남는다.
//! 그래서 화면은 늘 여기에 물어본다.

/// 레지스트리에 남길 이름. 작업 관리자의 시작 프로그램 목록에도 이 이름으로 보인다.
#[cfg(windows)]
const VALUE_NAME: &str = "Memojjang";

/// 이 인자로 켜지면 창을 띄우지 않고 트레이에만 올라온다.
/// 로그인하자마자 창이 튀어나오면 자동 시작을 켠 뜻과 어긋난다.
pub const TRAY_ARG: &str = "--tray";

/// 지금 이 프로세스가 트레이로만 시작해야 하는가.
pub fn started_for_tray() -> bool {
    std::env::args().any(|arg| arg == TRAY_ARG)
}

#[cfg(windows)]
mod win {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY,
        HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
    };

    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

    /// Windows API 가 받는 문자열은 널로 끝나는 UTF-16 이다.
    fn wide(text: &str) -> Vec<u16> {
        OsStr::new(text).encode_wide().chain(std::iter::once(0)).collect()
    }

    /// Run 키를 연다. 이 키는 늘 있으므로 만들지 않고 열기만 한다.
    fn open(access: u32) -> Result<HKEY, String> {
        let mut key: HKEY = std::ptr::null_mut();
        let status = unsafe {
            RegOpenKeyExW(HKEY_CURRENT_USER, wide(RUN_KEY).as_ptr(), 0, access, &mut key)
        };
        if status != ERROR_SUCCESS {
            return Err(format!("시작 프로그램 목록을 열지 못했습니다 (오류 {status})"));
        }
        Ok(key)
    }

    pub fn enabled() -> bool {
        let Ok(key) = open(KEY_READ) else {
            return false;
        };
        let status = unsafe {
            RegQueryValueExW(
                key,
                wide(super::VALUE_NAME).as_ptr(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        unsafe { RegCloseKey(key) };
        status == ERROR_SUCCESS
    }

    pub fn set(on: bool) -> Result<(), String> {
        let key = open(KEY_WRITE)?;

        let status = if on {
            let exe = std::env::current_exe()
                .map_err(|err| format!("실행 파일 자리를 알지 못했습니다: {err}"))?;
            // 경로에 빈칸이 있으면 따옴표가 없을 때 인자로 잘려 읽힌다.
            let command = format!("\"{}\" {}", exe.display(), super::TRAY_ARG);
            let data = wide(&command);
            unsafe {
                RegSetValueExW(
                    key,
                    wide(super::VALUE_NAME).as_ptr(),
                    0,
                    REG_SZ,
                    data.as_ptr() as *const u8,
                    // 널 문자까지 포함한 바이트 수여야 한다.
                    (data.len() * std::mem::size_of::<u16>()) as u32,
                )
            }
        } else {
            let status = unsafe { RegDeleteValueW(key, wide(super::VALUE_NAME).as_ptr()) };
            // 이미 없으면 지운 것과 같다.
            if status != ERROR_SUCCESS && !enabled() {
                ERROR_SUCCESS
            } else {
                status
            }
        };

        unsafe { RegCloseKey(key) };
        if status != ERROR_SUCCESS {
            return Err(format!("시작 프로그램 목록을 고치지 못했습니다 (오류 {status})"));
        }
        Ok(())
    }
}

pub fn enabled() -> bool {
    #[cfg(windows)]
    return win::enabled();
    #[cfg(not(windows))]
    false
}

pub fn set(on: bool) -> Result<(), String> {
    #[cfg(windows)]
    return win::set(on);
    #[cfg(not(windows))]
    {
        let _ = on;
        Err("이 운영체제에서는 아직 지원하지 않습니다.".into())
    }
}
