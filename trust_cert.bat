@echo off
echo Installing PL Tracker 2 SSL Certificate into Windows Trusted Root Store...
powershell -Command "Import-Certificate -FilePath '%~dp0cert.pem' -CertStoreLocation 'Cert:\CurrentUser\Root'"
echo.
echo SUCCESS! Certificate installed. Restart your browser and open https://pltracker.local:5000
pause
