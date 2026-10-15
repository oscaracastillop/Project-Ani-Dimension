@echo off
:: Comprobar si ya tiene permisos de administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando elevacion de administrador...
    powershell -Command "Start-Process cmd -ArgumentList '/c `"%~f0`"' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo   Habilitando puertos 7911, 7920 y 7922 en Windows Defender Firewall
echo ======================================================================
netsh advfirewall firewall delete rule name="Ani-Dimension Servidor" >nul 2>&1
netsh advfirewall firewall add rule name="Ani-Dimension Servidor" dir=in action=allow protocol=TCP localport=7911,7920,7922

echo.
echo ======================================================================
echo   [OK] Puertos habilitados correctamente:
echo        - 7911 (Duelos YGOPro)
echo        - 7920 (Autenticacion Ani-Dimension)
echo        - 7922 (Salas / Roomlist)
echo ======================================================================
echo.
timeout /t 5
