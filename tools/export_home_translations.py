"""Export the workbook's home/rental sheet for the embedded browser module.

Run from the repository root: python tools/export_home_translations.py
The generated dictionary only loads inside the home iframe.
"""

import json
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "translations" / "moov-ko-en.xlsx"
OUTPUT = ROOT / "front" / "public" / "moov-home" / "js" / "i18n-home-data.js"


def main():
    workbook = load_workbook(WORKBOOK, read_only=True, data_only=True)
    sheet = workbook["Home rental"]
    translations = {korean: english for _, korean, english, *_ in list(sheet.values)[1:]
                    if isinstance(korean, str) and isinstance(english, str) and english.strip()}
    # Preserve the departure wording while the workbook still has pickup labels.
    for korean, english in list(translations.items()):
        if '픽업' in korean:
            translations.setdefault(korean.replace('픽업', '출발').replace('출발으로', '출발지로'), english)
    translations['출발'] = 'Start'
    output = json.dumps(dict(sorted(translations.items())), ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "// Generated from the Home rental sheet in translations/moov-ko-en.xlsx.\n"
        f"window.MOOV_EN = Object.freeze({{...window.MOOV_EN, ...{output}}});\n",
        encoding="utf-8",
    )
    print(f"Exported {len(translations)} home phrases to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
