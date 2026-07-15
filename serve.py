import http.server
import socketserver
import os

PORT = 8001

# Se positionner dans le bon dossier
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class SafeHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        ret_path = super().translate_path(path)
        # Ne logguer que les fichiers et pas le bruit de fond
        if not path.endswith('/'):
            exists = os.path.exists(ret_path)
            print(f"[DIAGNOSTIC] Le navigateur demande: {path}")
            print(f"[DIAGNOSTIC] Le serveur cherche le fichier dans: {ret_path}")
            print(f"[DIAGNOSTIC] Fichier trouve sur le disque: {'OUI' if exists else 'NON'}")
        return ret_path

# Forcer les types de fichiers corrects pour le navigateur (règle le bug Windows)
SafeHandler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
})

class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

socketserver.TCPServer.allow_reuse_address = True

print(f"Demarrage du serveur multi-thread sur le port {PORT}...")
with ThreadingHTTPServer(("", PORT), SafeHandler) as httpd:
    print("Serveur actif (mode multi-thread). Pret.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrete.")
