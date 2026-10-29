@echo off
REM Windows Startup Script for Awiros ANPR OCR Persistent Worker
REM Runs inside isolated Python 3.11 virtual environment
SET VENV_DIR=%~dp0venv
IF NOT EXIST "%VENV_DIR%\Scripts\python.exe" (
    SET VENV_DIR=C:\Users\RAMEEZ\Downloads\awiros_standalone_test\venv
)

echo Starting Awiros OCR Worker on port 8008 using %VENV_DIR%...
"%VENV_DIR%\Scripts\python.exe" "%~dp0worker.py" --port 8008

