# MOOV English translation work

`moov-ko-en.xlsx` contains Korean strings found in the MOOV web source and the selected English translations. The `UI and voice`, `Home rental`, and `Map labels` sheets keep the existing app, integrated home/rental screen, and visible offline map labels separate. Source locations or OSM IDs make each entry traceable.

The `2차변경` column beside `English` records later wording changes shown in the UI. It leaves the original English draft intact. Context-dependent labels, such as featured sounds for each theme, list each display context in one cell. The browser export still reads `English` plus `site-overrides.json`; controls with context-specific wording use `data-i18n-en` in the UI source.

The translations were compared with an archived `moov-ko-en_san.xlsx`. The `비교 기록` sheet retains every differing draft and the selected version even if that source workbook is removed from the repository. Thirteen yoga pose labels include Sanskrit names. `검수 필요` and `문맥 확인 필요` still indicate editorial work before publication; fragments such as grammatical particles need to be checked in their assembled sentence.

The MOOV pages and browser speech use `front/public/i18n-data.js`, generated from the workbook and the additional UI phrases in `site-overrides.json`. After editing translations, run:

```sh
python tools/export_site_translations.py
```

The integrated home module uses `front/public/moov-home/js/i18n-home-data.js`, generated from the `Home rental` and `Map labels` sheets. This dictionary loads only inside the home iframe, so home wording can be shortened without changing other tabs. After editing either sheet, run:

```sh
python tools/export_home_translations.py
```

To refresh the home inventory while keeping existing translations, run:

```sh
python tools/extract_home_translations.py
python tools/extract_home_map_labels.py
```

The map sheet includes Korean names that the offline map may draw at its supported zoom levels. Names without an existing English form have a draft romanization marked `로마자 표기·감수 필요`. The OSM source names remain intact. The three promotional images have separate `-en.svg` files; edit those SVG text labels too if their English wording changes in the workbook.

If the archived Sanskrit workbook is available locally, repeat the historical comparison with:

```sh
python tools/merge_translation_workbooks.py
```

Regenerate the workbook from the repository root with:

```sh
python tools/extract_translations.py
```

The extraction is a review aid. Dynamic strings, text drawn into images, and strings assembled from code may need manual additions. Regenerating the workbook preserves English drafts, review status, and the comparison sheet. Re-export the browser dictionary after regeneration.
