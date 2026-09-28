$ErrorActionPreference = 'Stop'
$source = 'C:\Users\user\AppData\Local\Temp\moov-template.pptx'
$exportDir = 'C:\Users\user\AppData\Local\Temp\moov-storyboard-template-render'
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $ppt.Presentations.Open($source, $true, $false, $false)
    try {
        $presentation.Export($exportDir, 'PNG', 1600, 900)
        $slides = @()
        foreach ($slide in $presentation.Slides) {
            $shapes = @()
            foreach ($shape in $slide.Shapes) {
                $text = ''
                $fontName = ''
                $fontSize = $null
                if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                    $text = $shape.TextFrame.TextRange.Text
                    $fontName = $shape.TextFrame.TextRange.Font.Name
                    $fontSize = $shape.TextFrame.TextRange.Font.Size
                }
                $shapes += [pscustomobject]@{
                    name = $shape.Name
                    type = $shape.Type
                    left = [math]::Round($shape.Left, 2)
                    top = [math]::Round($shape.Top, 2)
                    width = [math]::Round($shape.Width, 2)
                    height = [math]::Round($shape.Height, 2)
                    text = $text
                    font = $fontName
                    fontSize = $fontSize
                }
            }
            $slides += [pscustomobject]@{ index = $slide.SlideIndex; shapes = $shapes }
        }
        [pscustomobject]@{
            slideWidth = $presentation.PageSetup.SlideWidth
            slideHeight = $presentation.PageSetup.SlideHeight
            slideCount = $presentation.Slides.Count
            slides = $slides
        } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath 'C:\Users\user\AppData\Local\Temp\moov-storyboard-template-inspection.json' -Encoding UTF8
    }
    finally {
        $presentation.Close()
    }
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt) | Out-Null
}
