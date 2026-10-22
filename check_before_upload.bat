@echo off
setlocal
python "%~dp0.publish\publish.py" check %*
if errorlevel 1 (
  echo Check failed. Do not publish until reviewed.
  pause
  exit /b 1
)
echo Check passed. This does not commit or push.
pause
