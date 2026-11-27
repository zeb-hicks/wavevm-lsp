//! Minimal C-ABI wrapper around the Wave2 assembler.
//!
//! Protocol: the host allocates a buffer with `alloc`, writes UTF-8 source into it,
//! calls `assemble(ptr, len)` and receives a pointer to a result buffer laid out as a
//! little-endian `u32` length followed by that many bytes of UTF-8 JSON. Both buffers
//! must be released with `dealloc(ptr, len)` (for the result, `len` is the prefix + 4).

use serde::Serialize;

#[derive(Serialize)]
struct Diagnostic {
    message: String,
    /// UTF-8 byte offsets into the source
    start: usize,
    end: usize,
}

#[derive(Serialize)]
struct Output {
    diagnostics: Vec<Diagnostic>,
}

fn into_raw(bytes: Vec<u8>) -> *mut u8 {
    Box::into_raw(bytes.into_boxed_slice()) as *mut u8
}

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    into_raw(vec![0; len])
}

/// # Safety
/// `ptr`/`len` must come from `alloc`, or from `assemble` using the total result length.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
}

/// # Safety
/// `ptr`/`len` must describe a valid buffer previously obtained from `alloc`.
#[no_mangle]
pub unsafe extern "C" fn assemble(ptr: *const u8, len: usize) -> *mut u8 {
    let bytes = std::slice::from_raw_parts(ptr, len);
    let diagnostics = match std::str::from_utf8(bytes) {
        Ok(source) => match waveasm::assemble_with_diagnostics(source) {
            Ok(_) => Vec::new(),
            Err(diagnostics) => diagnostics
                .into_iter()
                .map(|d| Diagnostic {
                    message: d.message,
                    start: d.span.start,
                    end: d.span.end,
                })
                .collect(),
        },
        Err(_) => vec![Diagnostic {
            message: "Source is not valid UTF-8".to_owned(),
            start: 0,
            end: 0,
        }],
    };

    let json = serde_json::to_vec(&Output { diagnostics }).expect("diagnostics serialize");
    let mut result = Vec::with_capacity(json.len() + 4);
    result.extend_from_slice(&(json.len() as u32).to_le_bytes());
    result.extend_from_slice(&json);
    into_raw(result)
}
