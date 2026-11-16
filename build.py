"""Combine original.html + add-ons into a single index.html."""
import pathlib
d = pathlib.Path(__file__).parent
r = lambda n: (d / n).read_text(encoding='utf-8')
h = r('original.html')
h = h.replace('<title>Sam & AT – Command Center (Liquid Glass preview)</title>', '<title>Sam & AT – Command Center v4</title>')
css = '\n'.join(r(f) for f in ('addon.css', 'addon2.css', 'addon3.css'))
h = h.replace('</head>', '<style>\n' + css + '\n</style>\n</head>', 1)
js = ''.join('<script>\n' + r(f) + '\n</script>\n' for f in ('addon.js', 'addon2.js', 'addon3.js'))
i = h.rindex('</body>')
h = h[:i] + js + h[i:]
(d / 'index.html').write_text(h, encoding='utf-8')
print(len(h))
