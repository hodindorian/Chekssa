# Chekssa

App de bureau (Windows/macOS/Linux) pour diffuser en live une image annotée (texte positionnable) en overlay, en haut à droite de l'écran, auprès de tous les utilisateurs connectés à une même session.

- `server/` — serveur Node.js (Express + Socket.IO) qui relaie les diffusions par session (code de session, pas d'authentification).
- `client/` — app Electron : process d'arrière-plan (tray) + fenêtre de composition (image + textes) + fenêtres overlay.

## Développement

```bash
npm install

# terminal 1 : serveur (par défaut sur http://localhost:4000)
npm run dev:server

# terminal 2 : app Electron
npm run dev:client
```

Dans l'app, rejoignez un code de session (ex: `EQUIPE1`) — n'importe quel code fonctionne, il est créé à la volée. Ouvrez une deuxième instance (autre poste, ou dossier `userData` différent) et rejoignez le même code pour tester la diffusion.

L'URL du serveur utilisée par le client est stockée localement (`https://chekssa.hodindorian.com` par défaut) ; elle peut être changée via l'IPC `settings:set-server-url` exposé au renderer.

## Build / packaging

```bash
npm run build:client
```

Génère les installeurs via `electron-builder` (NSIS sur Windows, DMG/ZIP sur macOS, AppImage sur Linux) dans `client/dist/`.

Un workflow GitHub Actions (`.github/workflows/release.yml`) construit automatiquement les 3 binaires et les publie dans une GitHub Release à chaque tag `v*` poussé (ex: `git tag v0.1.0 && git push origin v0.1.0`).

## Déploiement du serveur (VPS, Docker)

```bash
docker compose up -d --build
```

Le serveur Node écoute en interne sur le port 4000, exposé uniquement sur `127.0.0.1:4000` (pas d'accès public direct). Pointez votre reverse proxy existant (nginx/Caddy/Traefik) vers ce port pour servir `https://chekssa.hodindorian.com` en HTTPS. Exemple nginx (avec upgrade WebSocket requis pour Socket.IO) :

```nginx
# À placer dans le bloc http {} (ex: nginx.conf ou conf.d/websocket-upgrade.conf) :
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    server_name chekssa.hodindorian.com;
    listen 443 ssl;
    # ... certificats TLS ...

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
    }
}
```

⚠️ Ne mettez pas `Connection "upgrade"` en dur : Socket.IO utilise d'abord du polling HTTP classique (sans en-tête `Upgrade`) avant de tenter le websocket ; forcer `Connection: Upgrade` sur toutes les requêtes casse ce polling (erreur côté client : `xhr poll error`). Le `map` ci-dessus ne force `Upgrade` que quand c'est réellement une requête d'upgrade.

## Notes

- Aucune persistance côté serveur : les sessions n'existent que tant qu'il y a des clients connectés dedans.
- Les images sont redimensionnées/compressées côté client avant envoi (~1200px de large, JPEG).
- Hors scope pour l'instant : lancement automatique au démarrage de l'OS, comptes utilisateurs, signature de code des installeurs.
