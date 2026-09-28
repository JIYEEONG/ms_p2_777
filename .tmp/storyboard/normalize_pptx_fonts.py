from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

src = Path(r'C:\Users\user\AppData\Local\Temp\MOOV_storyboard_nanum_embedded.pptx')
dst = Path('.tmp/storyboard/MOOV_storyboard_nanum_candidate.pptx')

with ZipFile(src, 'r') as zin, ZipFile(dst, 'w', ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename.endswith(('.xml', '.rels')):
            data = data.replace('맑은 고딕'.encode('utf-8'), '나눔고딕'.encode('utf-8'))
            data = data.replace(b'Malgun Gothic', b'NanumGothic')
        zout.writestr(info, data)

print(dst)
