$ErrorActionPreference = 'Stop'

$template = 'C:\Users\user\AppData\Local\Temp\moov-template.pptx'
$assetDir = 'C:\Users\user\AppData\Local\Temp\moov-story-assets'
$output = 'C:\Users\user\AppData\Local\Temp\MOOV_admin_storyboard.pptx'
$fontName = '나눔고딕'
$dark = 0x3C3C3C
$navy = 0x171F34
$red = 0x2F2FFF
$blue = 0xD9622B
$lightBlue = 0xF6F1EA
$lightGray = 0xF5F5F5
$midGray = 0xD9D9D9
$textColor = 0x252525
$white = 0xFFFFFF

function Add-Rect($slide, $x, $y, $w, $h, $fill, $line = $null, $radius = $false) {
    $kind = if ($radius) { 5 } else { 1 }
    $s = $slide.Shapes.AddShape($kind, $x, $y, $w, $h)
    $s.Fill.ForeColor.RGB = $fill
    $s.Fill.Solid()
    if ($null -eq $line) { $s.Line.Visible = 0 } else { $s.Line.ForeColor.RGB = $line; $s.Line.Weight = 0.6 }
    return $s
}

function Add-Text($slide, $text, $x, $y, $w, $h, $size = 7, $color = 0x252525, $bold = $false, $align = 1, $vAlign = 1) {
    $s = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    $s.TextFrame.MarginLeft = 2
    $s.TextFrame.MarginRight = 2
    $s.TextFrame.MarginTop = 1
    $s.TextFrame.MarginBottom = 1
    $s.TextFrame.WordWrap = -1
    $s.TextFrame.AutoSize = 0
    $s.TextFrame.TextRange.Text = $text
    $s.TextFrame.TextRange.Font.Name = $fontName
    [single]$fontSizeValue = [single]$size
    $s.TextFrame.TextRange.Font.Size = $fontSizeValue
    $s.TextFrame.TextRange.Font.Bold = if ($bold) { -1 } else { 0 }
    $s.TextFrame.TextRange.Font.Color.RGB = $color
    $s.TextFrame.TextRange.ParagraphFormat.Alignment = $align
    $s.TextFrame.VerticalAnchor = $vAlign
    $s.Line.Visible = 0
    $s.Fill.Visible = 0
    return $s
}

function Add-CircleNumber($slide, $number, $x, $y, $size = 13) {
    $c = $slide.Shapes.AddShape(9, $x - ($size / 2), $y - ($size / 2), $size, $size)
    $c.Fill.ForeColor.RGB = $red
    $c.Fill.Solid()
    $c.Line.ForeColor.RGB = $white
    $c.Line.Weight = 0.7
    $c.TextFrame.MarginLeft = 0
    $c.TextFrame.MarginRight = 0
    $c.TextFrame.MarginTop = 0
    $c.TextFrame.MarginBottom = 0
    $c.TextFrame.TextRange.Text = [string]$number
    $c.TextFrame.TextRange.Font.Name = $fontName
    [single]$circleFontSize = if ($number -ge 10) { 5 } else { 6.5 }
    $c.TextFrame.TextRange.Font.Size = $circleFontSize
    $c.TextFrame.TextRange.Font.Bold = -1
    $c.TextFrame.TextRange.Font.Color.RGB = $white
    $c.TextFrame.TextRange.ParagraphFormat.Alignment = 2
    $c.TextFrame.VerticalAnchor = 3
    return $c
}

function Add-TopMeta($slide, $screenId, $screenName, $pathText) {
    $y = 4; $h = 24
    $cells = @(
        @{x=14; w=48; label='화면 ID'; value=$screenId; vw=72},
        @{x=138; w=48; label='화면명'; value=$screenName; vw=235},
        @{x=421; w=48; label='화면 경로'; value=$pathText; vw=244}
    )
    foreach ($cell in $cells) {
        Add-Rect $slide $cell.x $y $cell.w $h $dark | Out-Null
        Add-Text $slide $cell.label $cell.x $y $cell.w $h 6 $white $true 2 3 | Out-Null
        Add-Rect $slide ($cell.x + $cell.w) $y $cell.vw $h $white $midGray | Out-Null
        Add-Text $slide $cell.value ($cell.x + $cell.w + 2) $y ($cell.vw - 4) $h 6 $textColor $false 1 3 | Out-Null
    }
    Add-Rect $slide 779 $y 65 $h $dark | Out-Null
    Add-Text $slide '작성 기준' 779 $y 65 $h 6 $white $true 2 3 | Out-Null
    Add-Rect $slide 844 $y 102 $h $white $midGray | Out-Null
    Add-Text $slide '현행 구현 + 정책 1.0' 846 $y 98 $h 6 $textColor $false 1 3 | Out-Null
}

function Add-DescriptionPanel($slide, $items) {
    $x = 730; $y = 38; $w = 216; $h = 494; $barH = 27
    Add-Rect $slide $x $y $w $h $white $midGray | Out-Null
    Add-Rect $slide $x $y $w $barH $dark | Out-Null
    Add-Text $slide 'Description' $x $y $w $barH 8 $white $true 2 3 | Out-Null
    $bodyY = $y + $barH + 5
    $bodyH = $h - $barH - 9
    $slot = $bodyH / $items.Count
    for ($i = 0; $i -lt $items.Count; $i++) {
        $iy = $bodyY + ($i * $slot)
        Add-CircleNumber $slide ($i + 1) ($x + 12) ($iy + 9) 12 | Out-Null
        $title = Add-Text $slide $items[$i].Title ($x + 23) ($iy + 1) ($w - 29) 16 7 $textColor $true 1 1
        $body = Add-Text $slide $items[$i].Body ($x + 23) ($iy + 16) ($w - 29) ($slot - 18) 6.5 $textColor $false 1 1
        if ($i -lt $items.Count - 1) {
            $line = $slide.Shapes.AddLine($x + 8, $iy + $slot - 2, $x + $w - 8, $iy + $slot - 2)
            $line.Line.ForeColor.RGB = 0xE7E7E7
            $line.Line.Weight = 0.5
        }
    }
}

function Add-StoryboardSlide($presentation, $screenId, $screenName, $pathText, $imageIndex, $callouts, $items) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.ForeColor.RGB = $white
    Add-TopMeta $slide $screenId $screenName $pathText
    $imgX = 14; $imgY = 38; $imgW = 704; $imgH = 494
    $file = Join-Path $assetDir ('{0:d2}.png' -f $imageIndex)
    $slide.Shapes.AddPicture($file, 0, -1, $imgX, $imgY, $imgW, $imgH) | Out-Null
    Add-Rect $slide $imgX $imgY $imgW $imgH $white $midGray | ForEach-Object { $_.Fill.Transparency = 1 }
    for ($i = 0; $i -lt $callouts.Count; $i++) {
        $px = $callouts[$i][0]; $py = $callouts[$i][1]
        $cx = $imgX + ($px / 1440.0 * $imgW)
        $cy = $imgY + ($py / 1020.0 * $imgH)
        Add-CircleNumber $slide ($i + 1) $cx $cy 13 | Out-Null
    }
    Add-DescriptionPanel $slide $items
    return $slide
}

function Add-SectionCover($presentation, $title, $subtitle) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.ForeColor.RGB = $white
    Add-Rect $slide 0 190 960 126 $dark | Out-Null
    Add-Text $slide $title 0 214 960 48 30 $white $false 2 3 | Out-Null
    Add-Text $slide $subtitle 100 265 760 25 10 0xD8D8D8 $false 2 3 | Out-Null
    Add-Text $slide 'MOOV ADMIN STORYBOARD' 32 28 360 22 9 $dark $true 1 3 | Out-Null
    Add-Text $slide '현행 관리자 화면 및 백엔드 정책 기준' 32 492 450 20 7 0x777777 $false 1 3 | Out-Null
    return $slide
}

function Add-PolicyTableSlide($presentation, $title, $subtitle, $headers, $rows, $widths) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.ForeColor.RGB = $white
    Add-Text $slide $title 30 18 900 26 14 $textColor $true 1 3 | Out-Null
    $accent = Add-Rect $slide 18 18 5 26 $red | Out-Null
    Add-Text $slide $subtitle 30 45 900 20 7 0x666666 $false 1 3 | Out-Null
    $tableX = 28; $tableY = 76; $tableW = 904; $tableH = 430
    $tableShape = $slide.Shapes.AddTable($rows.Count + 1, $headers.Count, $tableX, $tableY, $tableW, $tableH)
    $table = $tableShape.Table
    for ($c = 1; $c -le $headers.Count; $c++) {
        $table.Columns.Item($c).Width = $widths[$c - 1]
        $cell = $table.Cell(1, $c).Shape
        $cell.Fill.ForeColor.RGB = $dark
        $cell.TextFrame.TextRange.Text = $headers[$c - 1]
        $cell.TextFrame.TextRange.Font.Name = $fontName
        $cell.TextFrame.TextRange.Font.Size = 7
        $cell.TextFrame.TextRange.Font.Bold = -1
        $cell.TextFrame.TextRange.Font.Color.RGB = $white
        $cell.TextFrame.TextRange.ParagraphFormat.Alignment = 2
        $cell.TextFrame.VerticalAnchor = 3
    }
    for ($r = 1; $r -le $rows.Count; $r++) {
        for ($c = 1; $c -le $headers.Count; $c++) {
            $cell = $table.Cell($r + 1, $c).Shape
            $cell.Fill.ForeColor.RGB = if (($r % 2) -eq 0) { $lightGray } else { $white }
            $cell.TextFrame.TextRange.Text = [string]$rows[$r - 1][$c - 1]
            $cell.TextFrame.TextRange.Font.Name = $fontName
            $cell.TextFrame.TextRange.Font.Size = 7
            $cell.TextFrame.TextRange.Font.Color.RGB = $textColor
            $cell.TextFrame.TextRange.ParagraphFormat.Alignment = if ($c -eq 1) { 2 } else { 1 }
            $cell.TextFrame.VerticalAnchor = 3
            $cell.TextFrame.MarginLeft = 4
            $cell.TextFrame.MarginRight = 4
            $cell.TextFrame.MarginTop = 2
            $cell.TextFrame.MarginBottom = 2
        }
    }
    return $slide
}

$ppt = New-Object -ComObject PowerPoint.Application
try {
    $ppt.Visible = -1
    $source = $ppt.Presentations.Open($template, $true, $false, $false)
    try { $source.SaveCopyAs($output) } finally { $source.Close() }
    $presentation = $ppt.Presentations.Open($output, $false, $false, $false)
    try {
        for ($i = $presentation.Slides.Count; $i -ge 1; $i--) { $presentation.Slides.Item($i).Delete() }
        $presentation.PageSetup.SlideWidth = 960
        $presentation.PageSetup.SlideHeight = 540

        Add-SectionCover $presentation 'MOOV 관리자 페이지 스토리보드' '화면별 기능, 운영 정책, UI/UX 및 예외 처리' | Out-Null

        $indexRows = @(
            @('SB-01', '대시보드', '운영 KPI, 기간 필터, 우선순위, 차트'),
            @('SB-02', '무인차 관리', '네이버 지도, 배차 적격, 상태 조치'),
            @('SB-03', '공간 상품', '상품 목록, 재고 판정, 등록 및 이동'),
            @('SB-04', '회원 관리', '회원 검색, 이용 요약, 거래 및 CSV'),
            @('SB-05~07', 'AI 말동무', '시스템 프롬프트, 페르소나, 사용량과 상태'),
            @('SB-08~11', '공간 테마', 'OTT, Wellness, Thema, 차량 환경'),
            @('공통', '운영 정책과 예외', '인증, 저장, 업로드, 오류 및 QA')
        )
        Add-PolicyTableSlide $presentation 'MOOV 관리자 화면 구성' '스토리보드 대상 화면과 설명 범위' @('ID','화면','핵심 설명 범위') $indexRows @(110,190,604) | Out-Null

        $commonRows = @(
            @('인증·권한', '관리자 세션과 허용 목록을 확인한다. 401은 로그인, 403은 권한 문의, 허용 목록 미설정은 503으로 구분한다.'),
            @('데이터 우선순위', '서버 값을 우선 사용한다. 404는 최초 설정으로 처리하며 502·504에서만 로컬 호환값을 사용한다.'),
            @('저장·충돌', '섹션 단위로 저장하고 ETag를 If-Match로 전달한다. 409 발생 시 편집값을 유지하고 새로고침 후 재적용한다.'),
            @('변경 감지', '저장 전 변경사항을 표시하고 이탈 경고를 제공한다. 저장 중에는 중복 클릭을 차단한다.'),
            @('파일 정책', '이미지·오디오는 20MB 이하, Python 프롬프트는 UTF-8 500KB 이하로 제한한다.'),
            @('상태 표현', '색상과 텍스트 배지를 함께 사용한다. 빈 데이터, 조회 실패, 미연동을 서로 다른 상태로 표시한다.'),
            @('파괴적 조치', '삭제·격리·테마 제거는 영향 대상을 다시 보여 주고 확인 후 실행한다.')
        )
        Add-PolicyTableSlide $presentation '공통 운영 정책' '모든 관리자 화면에 동일하게 적용하는 기준' @('정책','상세 기준') $commonRows @(150,754) | Out-Null

        $items = @(
            @{Title='연결 상태'; Body='백엔드 API 연결 수와 앱 계정 수를 표시한다. 일부 API 실패를 전체 정상으로 표시하지 않는다.'},
            @{Title='기간 선택'; Body='7일·30일·90일 중 하나만 활성화한다. 해당 기간 데이터가 없으면 빈 차트와 안내를 함께 표시한다.'},
            @{Title='핵심 KPI'; Body='매출·차량·상품·회원 값을 같은 기준 시점으로 계산한다. 예시값은 데이터 기준 라벨을 노출한다.'},
            @{Title='운영 우선순위'; Body='배차 가능, 입고 필요, 활성 회원 카드를 상세 메뉴 이동 링크로 사용한다. 권한 제한은 이동 후 안내한다.'},
            @{Title='매출·재고 차트'; Body='기간별 변화와 재고 건전성을 비교한다. 0건과 조회 실패를 같은 상태로 표현하지 않는다.'},
            @{Title='하단 운영 카드'; Body='차량 상태와 상품 수요를 요약한다. 상세 화면 건수와 모순되지 않도록 동일 판정식을 사용한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-01' '대시보드' '#dashboard' 1 @(@(1190,50),@(1290,168),@(690,265),@(650,430),@(560,690),@(1020,920)) $items | Out-Null

        $items = @(
            @{Title='상태 요약'; Body='전체, 배차 가능, 운행 중, 충전, 확인 필요 건수를 표시한다. 동일 차량을 여러 상태에 중복 집계하지 않는다.'},
            @{Title='검색·필터'; Body='차량 ID·권역·상태·데이터 종류로 범위를 축소한다. 필터 결과는 지도와 목록에 동시에 적용한다.'},
            @{Title='네이버 지도'; Body='마커와 차량 선택을 양방향 동기화한다. SDK 실패 시 목록과 상세 제어는 계속 사용할 수 있어야 한다.'},
            @{Title='차량 목록'; Body='차량명, 권역, 상태, SOC를 표시한다. GPS 지연 차량은 정상 배지 대신 지연 사유를 표시한다.'},
            @{Title='배차 적격'; Body='안전·보안·SOC 35% 이상·GPS 10초 이내·운영 상태 조건을 모두 통과해야 한다.'},
            @{Title='운영 조치'; Body='재배치·정비·격리·복귀를 제공한다. 부적격은 버튼을 비활성화하고 실패 조건을 인접 문구로 안내한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-02' '무인차 관리' '#vehicles' 2 @(@(480,225),@(570,355),@(600,670),@(1110,560),@(1180,790),@(1270,930)) $items | Out-Null

        $items = @(
            @{Title='재고 기준 안내'; Body='위험·주의·안정 기준과 계산 시점을 설명한다. 실제 수량과 예상 수량을 구분해 표시한다.'},
            @{Title='요약 카드'; Body='안정, 주의, 위험, 창고 이동 중 건수를 표시한다. 현재 필터가 바뀌면 카드 기준을 명시한다.'},
            @{Title='검색·필터'; Body='상품명·SKU·분류·상태·차량으로 조회한다. CSV는 현재 필터와 고정 열 순서를 따른다.'},
            @{Title='상품 목록'; Body='가격, 위치, 재고, 24시간 변화, 7일 예상, 권장 입고를 한 행에서 비교한다.'},
            @{Title='재고 판정'; Body='예상 2개 이하는 위험, 3~5개는 주의, 6개 이상은 안정이다. 예상이 5개 이하면 12개 기준으로 입고를 권장한다.'},
            @{Title='등록·변경'; Body='SKU 중복은 409로 차단한다. 입고·차감·실사와 창고 이동 조건을 검증하며 이미지 파일은 20MB 이하만 허용한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-03' '공간 상품' '#products' 3 @(@(660,150),@(560,260),@(740,380),@(820,660),@(1110,675),@(1280,180)) $items | Out-Null

        $items = @(
            @{Title='정책 안내'; Body='상단 고정 요약이 예시인지 실데이터인지 명확히 고지한다. 추정값으로 실 회원 수를 만들지 않는다.'},
            @{Title='결제 등록'; Body='거래 JSON을 관리자 권한으로 등록한다. 한 번에 1~5000건만 허용하며 유효성 실패 시 전체 요청을 중단한다.'},
            @{Title='회원 KPI'; Body='전체, 활성, 가입 방식, 평균 결제를 표시한다. 실제 집계가 없으면 0 또는 대시로 표시한다.'},
            @{Title='가입·매출 요약'; Body='Google과 일반 가입 비중, 상품·택시·렌트 이용을 비교한다. 원장과 예시 데이터를 혼합하지 않는다.'},
            @{Title='검색·목록'; Body='회원번호·이름·이메일·가입 유형·상태로 필터링하고 최근 가입 순 최대 500명을 표시한다.'},
            @{Title='개인정보·CSV'; Body='CSV는 관리자만 다운로드한다. 카드 원문·토큰·민감 대화는 화면과 로그에 노출하지 않는다.'}
        )
        Add-StoryboardSlide $presentation 'SB-04' '회원 관리' '#members' 4 @(@(760,145),@(750,205),@(690,315),@(720,500),@(720,670),@(1260,625)) $items | Out-Null

        $items = @(
            @{Title='관리자 접근'; Body='AI 설정 API는 관리자 인증을 요구한다. 401은 로그인, 403은 허용 목록 확인, 503은 운영 설정 필요 상태다.'},
            @{Title='기능 탭'; Body='시스템 프롬프트·페르소나 설정·차량 사용량을 독립 탭으로 제공하고 선택 상태를 한 개만 유지한다.'},
            @{Title='버전·연동 상태'; Body='설정 버전과 말동무 서버 연동 상태를 표시한다. 설정 저장만 가능한 경우 미연동 배지를 유지한다.'},
            @{Title='Python 가져오기'; Body='UTF-8 500KB 이하 파일에서 지정된 문자열 리터럴만 읽으며 Python 코드는 실행하지 않는다.'},
            @{Title='공통 프롬프트'; Body='안전 정책과 공통 대화 원칙을 입력한다. 최근 대화 6개와 사용자 동의 기반 기억 정책을 적용한다.'},
            @{Title='저장·충돌'; Body='ETag와 함께 저장한다. 409 충돌 시 현재 편집값을 유지하고 새로고침 후 병합·재저장을 안내한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-05' 'AI 말동무 · 시스템 프롬프트' '#ai-companion / system' 5 @(@(1180,55),@(560,175),@(600,270),@(600,365),@(770,630),@(1300,975)) $items | Out-Null

        $items = @(
            @{Title='페르소나 목록'; Body='무브, 토닥이, 척척박사, 링고를 고정 ID로 관리한다. 선택 항목의 설정만 우측 편집 영역에 연결한다.'},
            @{Title='이름·음성 ID'; Body='고객 앱 표시명과 공급자가 지원하는 음성 ID를 입력한다. 지원하지 않는 ID는 저장 전에 검증한다.'},
            @{Title='활성 상태'; Body='비활성 페르소나는 신규 선택 목록에서 숨기되 기존 설정과 자산은 보존한다.'},
            @{Title='대표 이미지'; Body='이미지 파일 20MB 이하만 업로드한다. 업로드 성공 후 설정 저장까지 완료해야 앱에 적용된다.'},
            @{Title='배경·음성 샘플'; Body='배경 이미지와 오디오 샘플을 개별 관리한다. 자산 해제는 연결만 제거하며 원본 삭제는 수명주기 정책을 따른다.'},
            @{Title='저장 피드백'; Body='저장하지 않은 변경을 표시하고 이탈 전에 경고한다. 실패 시 편집값을 유지해 재시도할 수 있게 한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-06' 'AI 말동무 · 페르소나 설정' '#ai-companion / persona' 6 @(@(440,380),@(820,350),@(810,445),@(850,630),@(990,810),@(1310,975)) $items | Out-Null

        $items = @(
            @{Title='수집 상태'; Body='외부 차량 자동 수집이 미연동이면 정상 대신 미연동으로 표시한다. JSON 가져오기와 앱 이벤트는 보조 경로다.'},
            @{Title='조회 기간'; Body='1일·7일·30일·90일 범위를 제공하고 기간 밖 이벤트를 제외한다.'},
            @{Title='차량 필터'; Body='전체 또는 단일 차량을 선택한다. 등록 전 차량 ID도 이벤트에 있으면 목록에 포함한다.'},
            @{Title='사용량 KPI'; Body='대화 건수·대화 시간·입력 토큰·출력 토큰을 합산한다. 조회 실패는 대시와 실패 문구로 표시한다.'},
            @{Title='구성요소 상태'; Body='STT·LLM·TTS·device 상태와 최근 보고 시각을 표시한다. 5분 초과 또는 누락은 확인 필요다.'},
            @{Title='이벤트 예외'; Body='event ID 중복을 재집계하지 않는다. 개인정보 보호를 위해 사용량 이벤트에 대화 원문이나 인증 정보를 넣지 않는다.'}
        )
        Add-StoryboardSlide $presentation 'SB-07' 'AI 말동무 · 차량 사용량' '#ai-companion / usage' 7 @(@(720,250),@(440,360),@(820,360),@(600,500),@(800,735),@(1110,980)) $items | Out-Null

        $items = @(
            @{Title='콘텐츠 탭'; Body='OTT·Wellness·Thema 중 하나를 선택한다. 탭별 저장 단위를 분리해 다른 유형의 편집값을 덮어쓰지 않는다.'},
            @{Title='앱 반영 상태'; Body='서버 저장 여부와 다음 앱 동기화 반영 안내를 표시한다. 저장 전 변경은 앱에 노출하지 않는다.'},
            @{Title='서비스 추가'; Body='새 OTT 카드를 기본값으로 만든다. 필수 서비스명이 비어 있으면 저장을 차단한다.'},
            @{Title='서비스 정보'; Body='서비스명과 공급사, 지원 차량 범위를 관리한다. 지정 차량 검증은 차량 연동 후 강화한다.'},
            @{Title='노출·삭제'; Body='활성 서비스만 앱에 노출한다. 사용 중 서비스 삭제는 확인 단계를 거치고 비활성 전환을 우선한다.'},
            @{Title='저장'; Body='콘텐츠 설정을 섹션 단위로 저장하고 성공 시점과 변경 해제 상태를 표시한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-08' '공간 테마 · OTT' '#themes / OTT' 8 @(@(480,190),@(700,270),@(470,320),@(600,470),@(1130,500),@(1300,980)) $items | Out-Null

        $items = @(
            @{Title='Wellness 탭'; Body='프로그램 설정만 표시하며 OTT와 Thema의 저장 내용은 유지한다.'},
            @{Title='프로그램 추가'; Body='기본값 카드로 새 프로그램을 생성한다. 빈 프로그램명은 저장할 수 없다.'},
            @{Title='프로그램명·유형'; Body='고객 앱 표시명과 지원 유형을 입력한다. 앱이 지원하지 않는 유형은 배포 전 검증한다.'},
            @{Title='기본 이용시간'; Body='분 단위 1~180 범위로 제한한다. 범위를 벗어난 입력은 즉시 안내하고 저장을 막는다.'},
            @{Title='앱 노출'; Body='활성 프로그램만 고객 앱에 노출한다. 비활성 데이터는 삭제하지 않고 다시 사용할 수 있게 보존한다.'},
            @{Title='삭제·저장'; Body='사용 이력이 있으면 삭제보다 비활성을 우선한다. 삭제는 확인 후 저장해야 확정된다.'}
        )
        Add-StoryboardSlide $presentation 'SB-09' '공간 테마 · Wellness' '#themes / Wellness' 9 @(@(560,190),@(520,315),@(480,450),@(560,570),@(610,680),@(1300,980)) $items | Out-Null

        $items = @(
            @{Title='Thema 탭'; Body='Forest·Sea·Sky·Space 등 공간 콘텐츠와 사운드를 관리한다. 최소 기본 테마를 유지하는 정책을 권장한다.'},
            @{Title='테마 목록'; Body='고유 ID와 표시명으로 선택한다. 비활성 테마는 편집 가능하지만 고객 앱에는 노출하지 않는다.'},
            @{Title='기본 정보'; Body='테마 이름과 설명을 입력한다. 상위 테마 비활성 시 하위 사운드도 앱에서 숨긴다.'},
            @{Title='대표 이미지'; Body='이미지 20MB 이하만 허용한다. 업로드 성공 뒤 설정 저장을 완료해야 URL이 적용된다.'},
            @{Title='사운드 정책'; Body='배경음·핵심 소리·선택 소리 카테고리와 0~100 음량을 관리한다. 오디오 파일만 허용한다.'},
            @{Title='가져오기·삭제'; Body='JSON 내보내기에 자격 정보를 포함하지 않는다. 테마와 소리 삭제는 확인 후 저장할 때 확정한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-10' '공간 테마 · Thema' '#themes / Thema' 10 @(@(600,190),@(430,390),@(860,430),@(800,650),@(760,890),@(1220,980)) $items | Out-Null

        $items = @(
            @{Title='기본 테마 카드'; Body='기본 콘텐츠·웰니스·수면·프라이빗을 선택한다. 현재 선택 카드를 명확히 강조한다.'},
            @{Title='실시간 미리보기'; Body='편집값을 즉시 반영해 앱 화면을 미리 본다. 미리보기 반영과 서버 저장을 구분한다.'},
            @{Title='이름·색상'; Body='테마 이름은 20자 이하로 제한하고 주요·보조·배경 색상을 미리보기에 연결한다.'},
            @{Title='UI 밀도'; Body='모서리 스타일과 정보 밀도를 선택한다. 텍스트 대비와 터치 영역이 유지되는 조합만 제공한다.'},
            @{Title='차량 환경'; Body='온도 18~28도, 창문 투명도 0~100을 5 단위로 조정하고 조명·프라이버시 상태를 표시한다.'},
            @{Title='저장·복원'; Body='차량 환경 저장으로 확정한다. 기본값 복원은 선택 테마만 대상으로 하며 이탈 전 미저장 경고를 제공한다.'}
        )
        Add-StoryboardSlide $presentation 'SB-11' '공간 테마 · 차량 환경' '#vehicle-environment' 11 @(@(520,230),@(1160,500),@(610,690),@(720,800),@(710,930),@(1280,170)) $items | Out-Null

        $exceptionRows = @(
            @('401', '관리자 로그인이 필요합니다', '읽기·편집 차단', '로그인 후 원래 화면 재진입'),
            @('403', '관리자 권한이 없습니다', '저장·업로드 비활성', '허용 목록 확인'),
            @('404', '저장된 설정이 없습니다', '기본값 또는 빈 상태', '검토 후 최초 저장'),
            @('409', '다른 관리자가 먼저 저장했습니다', '편집값 보존', '새로고침 후 병합·재저장'),
            @('413/415', '파일 크기 또는 형식 오류', '업로드 중단', '20MB 이하 허용 파일 선택'),
            @('502/504', '백엔드 연결을 확인하세요', '읽기 전용 또는 로컬 호환', '복구 후 새로고침'),
            @('503', '저장소 또는 허용 목록 설정 필요', '해당 기능 중단', '운영 환경 변수 확인'),
            @('지도 실패', '지도를 불러오지 못했습니다', '차량 목록·상세 유지', 'Client ID와 허용 URL 확인'),
            @('빈 데이터', '수집된 데이터가 없습니다', '정상으로 표시하지 않음', '연동 또는 가져오기 수행')
        )
        Add-PolicyTableSlide $presentation '공통 예외 처리와 복구 경로' '메시지에는 실패 원인과 사용자가 수행할 다음 행동을 함께 제공한다' @('상태','사용자 메시지','화면 처리','복구 방법') $exceptionRows @(90,300,210,304) | Out-Null

        $presentation.Save()
    }
    finally {
        $presentation.Close()
    }
}
finally {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ppt) | Out-Null
}
