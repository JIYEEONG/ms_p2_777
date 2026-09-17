"""Export the reviewed workbook for the browser UI and speech layer.

Run from the repository root: python tools/export_site_translations.py
"""

import json
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "translations" / "moov-ko-en.xlsx"
OUTPUT = ROOT / "front" / "public" / "i18n-data.js"
OVERRIDES = ROOT / "translations" / "site-overrides.json"


def main():
    sheet = load_workbook(WORKBOOK, read_only=True, data_only=True)["UI and voice"]
    translations = {}
    for _, korean, english, *_ in list(sheet.values)[1:]:
        if not isinstance(korean, str) or not isinstance(english, str):
            continue
        if english.startswith("[No English equivalent;"):
            continue
        translations[korean] = english
    translations.update(json.loads(OVERRIDES.read_text(encoding="utf-8")))
    output = json.dumps(dict(sorted(translations.items())), ensure_ascii=False, indent=2)
    OUTPUT.write_text(f"// Generated from translations/moov-ko-en.xlsx. Do not edit by hand.\nwindow.MOOV_EN = Object.freeze({output});\n", encoding="utf-8")
    print(f"Exported {len(translations)} phrases to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
