/**
 * Penyaring HTML artikel (tanpa dependency). Konten artikel dirender dengan
 * dangerouslySetInnerHTML di halaman publik /artikel/[slug], jadi skrip yang
 * lolos = XSS tersimpan. Pendekatan daftar-putih: HTML dibangun ulang — hanya
 * tag & atribut yang dikenal yang dikeluarkan, sisanya jadi teks yang di-escape.
 *
 * SALINAN yang sama ada di backend/src/common/utils/sanitize-html.util.ts — ubah keduanya.
 */

// Dibuang BESERTA isinya.
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'textarea',
    'title', 'xmp', 'noembed', 'noframes', 'frameset', 'frame', 'applet', 'svg', 'math',
    'select', 'option', 'plaintext',
]);

// Tag yang boleh tetap ada (keluaran editor Tiptap + tag format umum).
const ALLOWED_TAGS = new Set([
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's',
    'strike', 'del', 'ins', 'mark', 'small', 'sub', 'sup', 'code', 'pre', 'blockquote', 'ul',
    'ol', 'li', 'a', 'img', 'span', 'div', 'figure', 'figcaption', 'table', 'thead', 'tbody',
    'tfoot', 'tr', 'td', 'th', 'caption',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img']);

const GLOBAL_ATTRS = new Set(['class', 'title', 'style', 'data-align', 'align']);
const TAG_ATTRS: Record<string, Set<string>> = {
    a: new Set(['href', 'target', 'rel']),
    img: new Set(['src', 'alt', 'width', 'height', 'loading']),
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
    ol: new Set(['start', 'type']),
    li: new Set(['value']),
};
const URL_ATTRS = new Set(['href', 'src']);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const escText = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** URL aman: relatif, atau skema http/https/mailto/tel (javascript:/data:/dll. ditolak). */
function safeUrl(raw: string): boolean {
    const decoded = raw
        .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16) || 0))
        .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(Number(d) || 0))
        .replace(/&colon;/gi, ':')
        .replace(/&(tab|newline);/gi, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0020\u007f-\u00a0]+/g, '')
        .toLowerCase();
    const m = /^([a-z][a-z0-9+.-]*):/.exec(decoded);
    return !m || SAFE_SCHEMES.has(m[1]);
}

/** Gaya inline sederhana saja (rata teks, float gambar) — tanpa url()/expression. */
function safeStyle(v: string): boolean {
    return /^[a-z0-9\s:;.,%#()-]*$/i.test(v) && !/url\s*\(|expression|javascript|behavior/i.test(v);
}

function buildAttrs(tag: string, raw: string): string {
    const allowed = TAG_ATTRS[tag];
    let out = '';
    const seen = new Set<string>();
    ATTR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ATTR_RE.exec(raw))) {
        const name = m[1].toLowerCase();
        if (seen.has(name)) continue;
        if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue; // termasuk semua on*
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (URL_ATTRS.has(name) && !safeUrl(value)) continue;
        if (name === 'style' && !safeStyle(value)) continue;
        seen.add(name);
        out += ` ${name}="${escAttr(value)}"`;
    }
    return out;
}

export function sanitizeHtml(input: string | null | undefined): string {
    if (!input) return '';
    const html = String(input).replace(/<!--[\s\S]*?(-->|$)/g, '');
    let out = '';
    let pos = 0;
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(html))) {
        out += escText(html.slice(pos, m.index));
        pos = TAG_RE.lastIndex;
        const closing = m[1] === '/';
        const tag = m[2].toLowerCase();
        if (DROP_WITH_CONTENT.has(tag)) {
            if (closing) continue;
            // Lompati sampai penutupnya; tanpa penutup → sisa dokumen ikut dibuang.
            const end = new RegExp(`</${tag}[\\s/>]`, 'ig');
            end.lastIndex = pos;
            const e = end.exec(html);
            if (!e) { pos = html.length; break; }
            const close = html.indexOf('>', e.index);
            pos = close === -1 ? html.length : close + 1;
            TAG_RE.lastIndex = pos;
            continue;
        }
        if (!ALLOWED_TAGS.has(tag)) continue; // tag asing dibuang, isinya tetap
        if (closing) {
            if (!VOID_TAGS.has(tag)) out += `</${tag}>`;
            continue;
        }
        out += `<${tag}${buildAttrs(tag, m[3] || '')}>`;
    }
    out += escText(html.slice(pos));
    return out;
}
