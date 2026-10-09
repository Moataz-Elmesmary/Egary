// مقبض ملف وهمي يحاكي FileSystemFileHandle (للاختبارات)
module.exports = (b64) => `
(() => {
  const store = { get bytes() { const s = sessionStorage.getItem('__fake_bytes'); return s ? Uint8Array.from(atob(s), c => c.charCodeAt(0)) : Uint8Array.from(atob('${b64}'), c => c.charCodeAt(0)); }, set bytes(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); sessionStorage.setItem('__fake_bytes', btoa(s)); sessionStorage.setItem('__fake_mtime', String(Date.now())); } };
  if (!sessionStorage.getItem('__fake_mtime')) sessionStorage.setItem('__fake_mtime', '1000');
  class FakeHandle {
    constructor() { this.kind = 'file'; this.name = 'Egary.xlsx'; }
    async getFile() { const u8 = store.bytes; const f = new File([u8], 'Egary.xlsx', { lastModified: Number(sessionStorage.getItem('__fake_mtime')) }); return f; }
    async queryPermission() { return sessionStorage.getItem('__perm') || 'prompt'; }
    async requestPermission() { sessionStorage.setItem('__perm', 'granted'); return 'granted'; }
    async createWritable() { const chunks = []; return { write: async (d) => { chunks.push(new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer || d)); }, close: async () => { const total = chunks.reduce((s, c) => s + c.length, 0); const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } store.bytes = out; window.__writes = (window.__writes || 0) + 1; } }; }
  }
  window.showOpenFilePicker = async () => { window.__picked = true; return [new FakeHandle()]; };
  // IndexedDB تنسخ الكائن بلا دوال (المقبض الحقيقي يحتفظ بها) — نعيد تركيب الدوال بعد القراءة الحقيقية من IndexedDB
  document.addEventListener('DOMContentLoaded', () => {
    const FL = window.Egary && window.Egary.FileLink; if (!FL) return;
    FL.restore = async () => { const h = await FL.loadHandle(); return h ? FL.fileHandleAdapter(Object.setPrototypeOf(h, FakeHandle.prototype)) : null; };
  }, { once: true });
  window.__externalEdit = (bytesB64) => { store.bytes = Uint8Array.from(atob(bytesB64), c => c.charCodeAt(0)); };
  window.__fileBytes = () => { const u8 = store.bytes; let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
})();`;

