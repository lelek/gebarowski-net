// Storage can be blocked (private mode, site data off). The forms must work anyway, they only forget answers on reload.

export function readSaved(key) {
    try {
        return JSON.parse(sessionStorage.getItem(key));
    } catch {
        return null;
    }
}

export function save(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export function forget(key) {
    try {
        sessionStorage.removeItem(key);
    } catch {}
}
