# MOOV English translation work

`moov-ko-en.xlsx` contains Korean strings found in the MOOV web source and English translation drafts. The workbook records a source location for each phrase and merges identical Korean text from multiple files into one row.

All rows have an English draft. `검수 필요` marks manually translated yoga guidance from `wellness-en.json`; `용어 초안 · 검수 필요` marks UI terminology adjusted in `ui-corrections.json`; `기계 번역 · 검수 필요` marks machine-translated text that still needs a human review. The English column has not been connected to the website or voice guide.

Regenerate the workbook from the repository root with:

```sh
python tools/extract_translations.py
```

The extraction is a review aid. Dynamic strings, text drawn into images, and strings assembled from code may need manual additions before the English site is ready. Regenerating the workbook preserves English drafts and review status by their Korean source text.
