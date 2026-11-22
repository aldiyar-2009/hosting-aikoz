// Camera and microphone access for the trials. Nothing here talks to a network:
// streams are used locally and turned into blob: URLs that live only in this tab.
function constraints(kind) {
    const video = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
    if (kind === 'camera')
        return { video, audio: false };
    if (kind === 'mic')
        return { audio: true, video: false };
    return { video, audio: true };
}
function defaultGum() {
    if (typeof navigator === 'undefined')
        return undefined;
    const md = navigator.mediaDevices;
    return md && typeof md.getUserMedia === 'function' ? md.getUserMedia.bind(md) : undefined;
}
/** Ask for the camera and/or microphone. Never throws: a refusal comes back as a reason. */
export async function requestStream(kind, gum = defaultGum()) {
    if (!gum) {
        const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
        return { ok: false, reason: insecure ? 'insecure' : 'unsupported' };
    }
    try {
        return { ok: true, stream: await gum(constraints(kind)) };
    }
    catch (err) {
        const name = err?.name ?? '';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
            return { ok: false, reason: 'nodevice' };
        }
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
            return { ok: false, reason: 'denied' };
        }
        if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
            return { ok: false, reason: 'nodevice' };
        }
        return { ok: false, reason: 'unsupported' };
    }
}
export function stopStream(stream) {
    stream?.getTracks().forEach((t) => t.stop());
}
let counter = 0;
export function newItem(kind, url, sample = false, label) {
    counter += 1;
    return { id: `${Date.now()}-${counter}`, kind, url, createdAt: Date.now(), sample, label };
}
