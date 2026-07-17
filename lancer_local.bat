@echo off
title Serveur Local Expirés Lab
echo ====================================================
echo   DEMARRAGE DU SERVEUR LOCAL POUR LES EXPIRES LAB
echo ====================================================
echo.
echo L'application va s'ouvrir dans votre navigateur...
echo.
echo Pour fermer le serveur, fermez simplement cette fenetre.
echo.

:: Ouvre le navigateur sur localhost:8001 avec le nouveau chemin d'accès
start "" "http://localhost:8001/App/Application%%20-%%20p%%C3%%A9rim%%C3%%A9s.html"

:: Lance le serveur web de Python
python serve.py
