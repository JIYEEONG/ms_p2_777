# MOOV English translation work

`moov-ko-en.xlsx` contains Korean strings found in the MOOV web source and the selected English translations. The workbook records a source location for each phrase and merges identical Korean text from multiple files into one row.

The translations were compared with `moov-ko-en_san.xlsx`. The `비교 기록` sheet records every differing draft and the selected version. The Sanskrit workbook is left intact; 13 yoga pose labels in the selected workbook include Sanskrit names. A few UI labels were adjusted after checking their use in the source. `검수 필요` and `문맥 확인 필요` still indicate editorial work before publication; fragments such as grammatical particles need to be checked in their assembled sentence. The English column has not been connected to the website or voice guide.

Repeat the comparison after updating either workbook with:

```sh
python tools/merge_translation_workbooks.py
```

Regenerate the workbook from the repository root with:

```sh
python tools/extract_translations.py
```

The extraction is a review aid. Dynamic strings, text drawn into images, and strings assembled from code may need manual additions before the English site is ready. Regenerating the workbook preserves English drafts, review status, and the comparison sheet. Run the comparison command again if either source workbook changes.
