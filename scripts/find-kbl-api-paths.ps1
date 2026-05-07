# KBL JS 번들에서 실제 호출되는 API 경로 추출
#
# 실행: powershell -ExecutionPolicy Bypass -File scripts/find-kbl-api-paths.ps1
#       또는 PowerShell에서: .\scripts\find-kbl-api-paths.ps1

$ErrorActionPreference = "Stop"

# TLS 1.2 강제 (구형 환경 호환)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "[1/3] KBL 일정 페이지 HTML 가져오기..." -ForegroundColor Cyan
$html = (Invoke-WebRequest -Uri 'https://www.kbl.or.kr/match/schedule' -UseBasicParsing).Content

# HTML 안에서 JS 번들 경로 찾기
$jsMatch = [regex]::Match($html, 'src="(/assets/index-[^"]+\.js)"')
if (-not $jsMatch.Success) {
    Write-Host "✗ JS 번들 URL을 못 찾았습니다." -ForegroundColor Red
    exit 1
}
$jsPath = $jsMatch.Groups[1].Value
$jsUrl = "https://www.kbl.or.kr$jsPath"
Write-Host "  → $jsUrl" -ForegroundColor Gray

Write-Host ""
Write-Host "[2/3] JS 번들 다운로드 (800KB+)..." -ForegroundColor Cyan
$js = (Invoke-WebRequest -Uri $jsUrl -UseBasicParsing).Content
Write-Host "  → $($js.Length.ToString('N0')) 자" -ForegroundColor Gray

Write-Host ""
Write-Host "[3/3] /api/ 로 시작하는 경로 추출..." -ForegroundColor Cyan
$matches = [regex]::Matches($js, '/api/[a-zA-Z0-9/_\-{}]+')
$paths = $matches | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  API 경로 후보 ($($paths.Count) 개)" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Yellow

# 일정/경기 관련만 강조 표시
foreach ($p in $paths) {
    if ($p -match 'game|match|schedule|calendar') {
        Write-Host "  ★ $p" -ForegroundColor Green
    } else {
        Write-Host "    $p" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "TIP: ★ 표시된 경로(일정·경기 관련)를 Claude에게 공유하세요." -ForegroundColor Cyan

# 결과를 파일로도 저장
$outFile = "data/raw/api/discovered-paths.txt"
$paths | Out-File -FilePath $outFile -Encoding UTF8
Write-Host "  → 전체 목록 저장: $outFile" -ForegroundColor Gray
