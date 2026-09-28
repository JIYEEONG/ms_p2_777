$ErrorActionPreference = 'Stop'
$ppt = New-Object -ComObject PowerPoint.Application
try {
    $p = $ppt.Presentations.Open('C:\Users\user\AppData\Local\Temp\MOOV_storyboard_font_source.pptx', $true, $false, $false)
    try {
        $p | Get-Member | Where-Object Name -Match 'Embed|Font|Save' | Select-Object Name,MemberType,Definition | Format-Table -AutoSize | Out-String -Width 300 | Write-Output
        $ppt | Get-Member | Where-Object Name -Match 'Embed|Font|Save|Option' | Select-Object Name,MemberType,Definition | Format-Table -AutoSize | Out-String -Width 300 | Write-Output
    }
    finally { $p.Close() }
}
finally { $ppt.Quit() }
