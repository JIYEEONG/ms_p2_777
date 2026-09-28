from pathlib import Path
import json
from docx import Document
from docx.oxml.ns import qn

src = Path('.tmp/storyboard/MOOV_관리자_페이지_기획서_최종.docx')
out = Path('.tmp/storyboard/screens')
out.mkdir(parents=True, exist_ok=True)
doc = Document(src)

current_heading = ''
items = []
count = 0

for p in doc.paragraphs:
    text = p.text.strip()
    if p.style and p.style.name.startswith('Heading') and text:
        current_heading = text
    for drawing in p._p.xpath('.//w:drawing'):
        blips = drawing.xpath('.//a:blip')
        if not blips:
            continue
        rid = blips[0].get(qn('r:embed'))
        part = doc.part.related_parts[rid]
        count += 1
        suffix = Path(str(part.partname)).suffix or '.png'
        filename = f'{count:02d}_{current_heading.replace("/", "-")}{suffix}'
        (out / filename).write_bytes(part.blob)
        items.append({'index': count, 'heading': current_heading, 'file': filename})

Path('.tmp/storyboard/docx_images.json').write_text(
    json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8'
)

print(json.dumps(items, ensure_ascii=False, indent=2))
