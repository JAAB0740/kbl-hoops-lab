@echo off
REM ─────────────────────────────────────────────────────────────
REM  KBL Hoops Lab — 데이터 자동 fetch
REM
REM  - Windows 작업 스케줄러에서 호출되는 진입점
REM  - 모든 KBL 데이터(일정/팀/선수/2차스탯)를 갱신
REM  - 결과는 data\last-fetch.log 에 누적 저장
REM ─────────────────────────────────────────────────────────────

setlocal

REM 이 배치 파일의 부모 폴더로 이동 (= kbl-hoops-lab 루트)
cd /d "%~dp0\.."

REM 시각 헤더 (로그용)
echo. >> "data\last-fetch.log"
echo ============================================================ >> "data\last-fetch.log"
echo  Fetch run @ %DATE% %TIME% >> "data\last-fetch.log"
echo ============================================================ >> "data\last-fetch.log"

REM npm run fetch:all 실행 (출력 + 에러 모두 로그로)
call npm run fetch:all >> "data\last-fetch.log" 2>&1

echo. >> "data\last-fetch.log"
echo  Done @ %DATE% %TIME% >> "data\last-fetch.log"

endlocal
