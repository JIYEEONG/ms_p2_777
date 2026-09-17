# MOOV English translation work

`moov-ko-en.xlsx` contains Korean strings found in the MOOV web source and the selected English translations. The workbook records a source location for each phrase and merges identical Korean text from multiple files into one row.

The `2차변경` column beside `English` records later wording changes shown in the UI. It leaves the original English draft intact. Context-dependent labels, such as featured sounds for each theme, list each display context in one cell. The browser export still reads `English` plus `site-overrides.json`; controls with context-specific wording use `data-i18n-en` in the UI source.

The translations were compared with an archived `moov-ko-en_san.xlsx`. The `비교 기록` sheet retains every differing draft and the selected version even if that source workbook is removed from the repository. Thirteen yoga pose labels include Sanskrit names. `검수 필요` and `문맥 확인 필요` still indicate editorial work before publication; fragments such as grammatical particles need to be checked in their assembled sentence.

The MOOV pages and browser speech use `front/public/i18n-data.js`, generated from the workbook and the additional UI phrases in `site-overrides.json`. After editing translations, run:

```sh
python tools/export_site_translations.py
```

If the archived Sanskrit workbook is available locally, repeat the historical comparison with:

```sh
python tools/merge_translation_workbooks.py
```

Regenerate the workbook from the repository root with:

```sh
python tools/extract_translations.py
```

The extraction is a review aid. Dynamic strings, text drawn into images, and strings assembled from code may need manual additions. Regenerating the workbook preserves English drafts, review status, and the comparison sheet. Re-export the browser dictionary after regeneration.
