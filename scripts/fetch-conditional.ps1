# KBL Hoops Lab - conditional auto fetch
#
# Windows Task Scheduler does not know Korean public holidays, so this
# wrapper decides at runtime whether today should fetch:
#
#   -Slot Holiday  : fetch only if today is a weekend or Korean holiday
#   -Slot Weekday  : fetch only if today is a regular non-holiday weekday
#
# The holiday list is data\holidays.json (refresh each season).
#
# Examples:
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-conditional.ps1 -Slot Holiday
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-conditional.ps1 -Slot Weekday

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Holiday", "Weekday")]
  [string]$Slot
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

# 1. Load holiday list
$holidaysPath = Join-Path $root "data\holidays.json"
$holidayDates = @()
$holidayName = $null
if (Test-Path $holidaysPath) {
  try {
    $hjson = Get-Content $holidaysPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($hjson.dates) {
      $holidayDates = $hjson.dates.PSObject.Properties.Name
    }
  } catch {
    Write-Warning "Failed to parse holidays.json: $_"
  }
}

# 2. Today
$today = Get-Date
$todayKey = $today.ToString("yyyy-MM-dd")
$dow = $today.DayOfWeek
$isWeekend = ($dow -eq [DayOfWeek]::Saturday) -or ($dow -eq [DayOfWeek]::Sunday)
$isHoliday = $holidayDates -contains $todayKey
$isOff = $isWeekend -or $isHoliday  # off-day = weekend or public holiday

if ($isHoliday -and $hjson.dates) {
  $holidayName = $hjson.dates.$todayKey
}

# 3. Log header
$logPath = Join-Path $root "data\last-fetch.log"
"" | Out-File $logPath -Append -Encoding UTF8
"============================================================" | Out-File $logPath -Append -Encoding UTF8
"  Conditional fetch @ $($today.ToString('yyyy-MM-dd HH:mm:ss')) ($dow) - Slot: $Slot" | Out-File $logPath -Append -Encoding UTF8
if ($isHoliday) {
  "  -> Holiday today: $holidayName" | Out-File $logPath -Append -Encoding UTF8
}
"============================================================" | Out-File $logPath -Append -Encoding UTF8

# 4. Decide
$shouldRun = $false
$skipReason = ""

if ($Slot -eq "Holiday") {
  if ($isOff) {
    $shouldRun = $true
  } else {
    $skipReason = "Slot=Holiday but today is a regular weekday (the 21:30 task will handle it)"
  }
} else {
  # Slot=Weekday
  if (-not $isOff) {
    $shouldRun = $true
  } else {
    $skipReason = "Slot=Weekday but today is an off-day (the 16:30 task already handled it)"
  }
}

if (-not $shouldRun) {
  "  Skip - $skipReason" | Out-File $logPath -Append -Encoding UTF8
  Write-Host "Skip - $skipReason"
  exit 0
}

# 5. Run fetch
"  Run: npm run fetch:all" | Out-File $logPath -Append -Encoding UTF8
Write-Host "Running fetch-all..."
Push-Location $root
try {
  & cmd /c "npm run fetch:all >> `"$logPath`" 2>&1"
  $exit = $LASTEXITCODE
} finally {
  Pop-Location
}

"  Done @ $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) (exit=$exit)" | Out-File $logPath -Append -Encoding UTF8
exit $exit
