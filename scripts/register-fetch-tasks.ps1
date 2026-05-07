# KBL Hoops Lab - register auto-fetch scheduled tasks
#
# Both tasks fire daily, but fetch-conditional.ps1 (the wrapper) decides
# whether today should actually run a fetch:
#
#   Holiday slot (16:30) - runs only on weekends + Korean public holidays
#   Weekday slot (21:30) - runs only on regular weekdays (non-holiday)
#
# Holiday list lives in data\holidays.json (refresh once per season).
#
# Tasks are registered with these settings:
#   - StartWhenAvailable      : run as soon as possible if PC was off at trigger time
#   - AllowStartIfOnBatteries : run even on battery (laptops)
#   - DontStopIfGoingOnBatteries
#
# Usage (one-time):
#   powershell -ExecutionPolicy Bypass -File scripts\register-fetch-tasks.ps1
# or:
#   .\scripts\register-fetch-tasks.ps1
#
# To remove tasks:
#   schtasks /Delete /TN "KBL Hoops Lab Fetch (Holiday 16-30)" /F
#   schtasks /Delete /TN "KBL Hoops Lab Fetch (Weekday 21-30)" /F

$ErrorActionPreference = "Stop"

# Resolve absolute path of the wrapper
$ps1 = (Resolve-Path "$PSScriptRoot\fetch-conditional.ps1").Path
Write-Host "Wrapper: $ps1" -ForegroundColor Gray

# Clean up old tasks if they exist (from previous schedule designs)
$oldTasks = @(
  "KBL Hoops Lab Fetch (Weekday)",
  "KBL Hoops Lab Fetch (Weekend)",
  "KBL Hoops Lab Fetch (Holiday 16-30)",
  "KBL Hoops Lab Fetch (Weekday 21-30)"
)
foreach ($t in $oldTasks) {
  $existing = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Removing existing task: $t" -ForegroundColor DarkGray
    Unregister-ScheduledTask -TaskName $t -Confirm:$false
  }
}

# Common settings for both tasks
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Run as the current user, only when logged on (interactive)
$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

# Task 1 - daily 16:30 (Holiday slot)
Write-Host ""
Write-Host "[1/2] Registering Holiday 16-30 task..." -ForegroundColor Cyan
$action1 = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`" -Slot Holiday"
$trigger1 = New-ScheduledTaskTrigger -Daily -At "16:30"
Register-ScheduledTask `
  -TaskName "KBL Hoops Lab Fetch (Holiday 16-30)" `
  -Action $action1 `
  -Trigger $trigger1 `
  -Settings $settings `
  -Principal $principal `
  -Description "KBL data fetch on weekends and Korean public holidays" `
  -Force | Out-Null

# Task 2 - daily 21:30 (Weekday slot)
Write-Host ""
Write-Host "[2/2] Registering Weekday 21-30 task..." -ForegroundColor Cyan
$action2 = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`" -Slot Weekday"
$trigger2 = New-ScheduledTaskTrigger -Daily -At "21:30"
Register-ScheduledTask `
  -TaskName "KBL Hoops Lab Fetch (Weekday 21-30)" `
  -Action $action2 `
  -Trigger $trigger2 `
  -Settings $settings `
  -Principal $principal `
  -Description "KBL data fetch on regular weekdays (non-holiday)" `
  -Force | Out-Null

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host ""
Write-Host "How it works:" -ForegroundColor Gray
Write-Host "  Both tasks fire every day, but the wrapper checks the date and only" -ForegroundColor Gray
Write-Host "  one of them actually runs the fetch:" -ForegroundColor Gray
Write-Host "    Holiday slot (16:30): runs on weekends + Korean public holidays" -ForegroundColor Gray
Write-Host "    Weekday slot (21:30): runs on regular weekdays" -ForegroundColor Gray
Write-Host ""
Write-Host "Settings applied:" -ForegroundColor Gray
Write-Host "  - StartWhenAvailable   : run ASAP after a missed trigger (PC off / sleep)" -ForegroundColor Gray
Write-Host "  - Battery-friendly     : run on battery, do not stop when going on battery" -ForegroundColor Gray
Write-Host "  - 1h execution limit" -ForegroundColor Gray
Write-Host ""
Write-Host "Verify:" -ForegroundColor Gray
Write-Host "  Get-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Holiday 16-30)""  | Select-Object * " -ForegroundColor Gray
Write-Host "  Get-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Weekday 21-30)"" | Select-Object * " -ForegroundColor Gray
Write-Host ""
Write-Host "Run manually (test):" -ForegroundColor Gray
Write-Host "  Start-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Holiday 16-30)""" -ForegroundColor Gray
Write-Host "  Start-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Weekday 21-30)""" -ForegroundColor Gray
Write-Host ""
Write-Host "Remove:" -ForegroundColor Gray
Write-Host "  Unregister-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Holiday 16-30)"" -Confirm:`$false" -ForegroundColor Gray
Write-Host "  Unregister-ScheduledTask -TaskName ""KBL Hoops Lab Fetch (Weekday 21-30)"" -Confirm:`$false" -ForegroundColor Gray
Write-Host ""
Write-Host "Log file: data\last-fetch.log" -ForegroundColor Yellow
Write-Host "Holiday list: data\holidays.json (refresh once per season)" -ForegroundColor Yellow
