export interface TtsCapability {
  ok: boolean;
  reason?: string;
  device: 'webgpu' | 'wasm';
}

// A minimal valid WASM module with a SIMD instruction, used only to probe
// whether the runtime supports WASM SIMD (transformers.js's wasm backend
// needs it for acceptable performance).
const WASM_SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1,
  8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

function hasWasmSimd(): boolean {
  try {
    return WebAssembly.validate(WASM_SIMD_PROBE);
  } catch {
    return false;
  }
}

/**
 * Whether this device/browser can reasonably run Kokoro locally. Desktop
 * only for now: on a phone-class device (little RAM, or a coarse pointer —
 * the model's ~340MB working set is the same failure mode as the video
 * exporter's `deviceMemory <= 2` guard) voiceover is disabled with a plain
 * reason string rather than letting the tab crash mid-generation.
 */
export function ttsCapability(preferWebGpu = false): TtsCapability {
  if (typeof WebAssembly === 'undefined' || typeof AudioContext === 'undefined') {
    return { ok: false, reason: 'This browser cannot run local voiceover. Try Chrome or Edge on desktop.', device: 'wasm' };
  }
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (typeof deviceMemory === 'number' && deviceMemory <= 2) {
    return { ok: false, reason: 'Voiceover needs more memory than this device has. Try a desktop computer.', device: 'wasm' };
  }
  if (!hasWasmSimd()) {
    return { ok: false, reason: 'This browser is missing WebAssembly SIMD support needed for voiceover. Try updating your browser.', device: 'wasm' };
  }
  const hasWebGpu = preferWebGpu && typeof navigator !== 'undefined' && 'gpu' in navigator;
  return { ok: true, device: hasWebGpu ? 'webgpu' : 'wasm' };
}
