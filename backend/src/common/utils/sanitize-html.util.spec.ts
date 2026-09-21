import { sanitizeHtml } from './sanitize-html.util';

describe('sanitizeHtml — konten artikel publik', () => {
    it('keluaran editor tetap utuh', () => {
        const html =
            '<h2>Judul</h2><p style="text-align: center">Halo <strong>dunia</strong> &amp; <a target="_blank" rel="noopener noreferrer nofollow" href="https://voliko.id">tautan</a></p>' +
            '<img src="/uploads/a.png" data-align="left" style="float:left;margin:4px 16px 12px 0;max-width:50%;"><ul><li><p>satu</p></li></ul>';
        expect(sanitizeHtml(html)).toBe(html);
    });

    it('membuang script/iframe/style beserta isinya', () => {
        const out = sanitizeHtml('<p>a</p><script>alert(1)</script><IFRAME src="x"></iframe><style>*{}</style><svg><script>x</script></svg><p>b</p>');
        expect(out).toBe('<p>a</p><p>b</p>');
    });

    it('membuang atribut on* dan URL javascript:/data:', () => {
        const out = sanitizeHtml(
            '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">a</a><a href="jav&#x09;ascript&colon;alert(1)">b</a><img src="data:text/html;base64,xx">',
        );
        expect(out).toBe('<img src="x"><a>a</a><a>b</a><img>');
        expect(out).not.toMatch(/onerror|javascript|data:/i);
    });

    it('tag rusak/asing jadi teks, bukan tag', () => {
        expect(sanitizeHtml('<img src=x/onerror=alert(1)>')).toBe('&lt;img src=x/onerror=alert(1)&gt;');
        expect(sanitizeHtml('<scr<script>x</script>ipt>alert(1)</scr<script>x</script>ipt>')).not.toMatch(/<script/i);
        expect(sanitizeHtml('<details open ontoggle=alert(1)>x</details>')).toBe('x');
    });

    it('idempoten', () => {
        const once = sanitizeHtml('<p title=\'a"b\'>x < y</p><form action="javascript:1"><b>z</b></form>');
        expect(sanitizeHtml(once)).toBe(once);
    });
});
