@echo off
title Serveur Local Expirés Lab
echo ====================================================
echo   DEMARRAGE DU SERVEUR LOCAL POUR LES EXPIRES LAB
echo ====================================================
echo.
echo L'application va s'ouvrir dans votre navigateur...
echo Pour fermer le serveur, fermez simplement cette fenetre.
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
