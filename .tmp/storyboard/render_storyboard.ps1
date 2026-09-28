$ErrorActionPreference = 'Stop'
$source = 'C:\Users\user\AppData\Local\Temp\MOOV_admin_storyboard.pptx'
$exportDir = 'C:\Users\user\AppData\Local\Temp\moov-storyboard-render'
if (Test-Path -LiteralPath $exportDir) { Remove-Item -LiteralPath $exportDir -Recurse -Force }
New-Item -ItemType Directory -Path $exportDir | Out-Null
$ppt = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $ppt.Presentations.Open($source, $true, $false, $false)
    try { $presentation.Export($exportDir, 'PNG', 1600, 900) }
    finally { $presentation.Close() }
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt) | Out-Null
}
