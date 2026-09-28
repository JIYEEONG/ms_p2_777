$ErrorActionPreference = 'Stop'
$source = 'C:\Users\user\AppData\Local\Temp\MOOV_storyboard_font_source.pptx'
$output = 'C:\Users\user\AppData\Local\Temp\MOOV_storyboard_nanum_embedded.pptx'
$fontDir = 'C:\Users\user\AppData\Local\Temp\MOOV_NanumFonts'
$fontName = '나눔고딕'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FontResource {
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    public static extern int AddFontResourceEx(string fileName, uint flags, IntPtr reserved);
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
    public static extern bool RemoveFontResourceEx(string fileName, uint flags, IntPtr reserved);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
}
'@

function Set-ShapeFont($shape) {
    if ($shape.Type -eq 6) {
        for ($i = 1; $i -le $shape.GroupItems.Count; $i++) { Set-ShapeFont $shape.GroupItems.Item($i) }
    }
    if ($shape.HasTable) {
        for ($r = 1; $r -le $shape.Table.Rows.Count; $r++) {
            for ($c = 1; $c -le $shape.Table.Columns.Count; $c++) {
                $cellShape = $shape.Table.Cell($r, $c).Shape
                if ($cellShape.HasTextFrame -and $cellShape.TextFrame.HasText) {
                    $cellShape.TextFrame.TextRange.Font.Name = $fontName
                    try { $cellShape.TextFrame.TextRange.Font.NameFarEast = $fontName } catch {}
                }
            }
        }
    }
    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
        $shape.TextFrame.TextRange.Font.Name = $fontName
        try { $shape.TextFrame.TextRange.Font.NameFarEast = $fontName } catch {}
    }
}

$fontFiles = Get-ChildItem -LiteralPath $fontDir -Filter '*.ttf' | Select-Object -ExpandProperty FullName
$registered = @()
try {
    foreach ($font in $fontFiles) {
        if ([FontResource]::AddFontResourceEx($font, 0, [IntPtr]::Zero) -gt 0) { $registered += $font }
    }
    $broadcast = [IntPtr]0xffff
    $result = [IntPtr]::Zero
    [FontResource]::SendMessageTimeout($broadcast, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 3000, [ref]$result) | Out-Null

    $ppt = New-Object -ComObject PowerPoint.Application
    try {
        $presentation = $ppt.Presentations.Open($source, $false, $false, $false)
        try {
            foreach ($slide in $presentation.Slides) {
                foreach ($shape in $slide.Shapes) { Set-ShapeFont $shape }
            }
            foreach ($shape in $presentation.SlideMaster.Shapes) { Set-ShapeFont $shape }
            foreach ($layout in $presentation.SlideMaster.CustomLayouts) {
                foreach ($shape in $layout.Shapes) { Set-ShapeFont $shape }
            }
            $presentation.SaveAs($output, 24, -1)
        }
        finally { $presentation.Close() }
    }
    finally {
        $ppt.Quit()
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt) | Out-Null
    }
}
finally {
    foreach ($font in $registered) { [FontResource]::RemoveFontResourceEx($font, 0, [IntPtr]::Zero) | Out-Null }
    $result = [IntPtr]::Zero
    [FontResource]::SendMessageTimeout([IntPtr]0xffff, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 3000, [ref]$result) | Out-Null
}
