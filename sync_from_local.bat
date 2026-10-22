@echo off
setlocal
python "%~dp0.publish\publish.py" sync %*
if errorlevel 1 (
  echo Synchronization blocked. No commit or push was performed.
  pause
  exit /b 1
)
echo Ready for manual git diff, git add, git commit and git push.
pause
