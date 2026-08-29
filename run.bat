@echo off
rem Windows: このファイルをダブルクリックして起動します。
setlocal
cd /d "%~dp0"

where deno >nul 2>nul
if errorlevel 1 (
  echo Deno が見つかりません。https://deno.com/ からインストールしてから、もう一度実行してください。
  pause
  exit /b 1
)

echo 囲みコードをビルドして起動します…
set "ENV_ARG="
if exist ".env" set "ENV_ARG=--env-file=.env"
call deno task %ENV_ARG% desktop:windows
if errorlevel 1 (
  echo ビルドに失敗しました。
  pause
  exit /b 1
)

if exist "Kakomimasu\Kakomimasu.bat" (
  start "囲みコード" /D "%CD%\Kakomimasu" cmd /c Kakomimasu.bat
) else if exist "app.exe" (
  start "囲みコード" "%CD%\app.exe"
) else (
  echo Desktopアプリが見つかりませんでした。
  pause
  exit /b 1
)
