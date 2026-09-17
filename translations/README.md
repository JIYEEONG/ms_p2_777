# MOOV English translation work

`moov-ko-en.xlsx` is a draft inventory of Korean strings found in the MOOV web source. The workbook records a source location for each phrase and merges identical Korean text from multiple files into one row.

The `English` column is being filled in stages. `검수 필요` means an English draft exists; `번역 필요` means it has not been translated yet. The first translated batch covers yoga pose names, spoken instructions, and safety notes in `wellness-en.json`.

Regenerate the workbook from the repository root with:

```sh
python tools/extract_translations.py
```

The extraction is a review aid. Dynamic strings, text drawn into images, and strings assembled from code may need manual additions before the English site is ready.
