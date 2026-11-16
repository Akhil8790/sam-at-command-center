import pathlib
d=pathlib.Path(__file__).parent
h=(d/'original.html').read_text(encoding='utf-8')
h=h.replace('<title>Sam & AT – Command Center (Liquid Glass preview)</title>','<title>Sam & AT – Command Center v2</title>')
h=h.replace('</head>','<style>\n'+(d/'addon.css').read_text(encoding='utf-8')+'\n</style>\n</head>',1)
i=h.rindex('</body>')
h=h[:i]+'<script>\n'+(d/'addon.js').read_text(encoding='utf-8')+'\n</script>\n'+h[i:]
(d/'index.html').write_text(h,encoding='utf-8')
print(len(h))
