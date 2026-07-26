# Manger des Sushis

Carte interactive et commandes partagées pour le **Hanami**.
Compose ta commande, exporte un PNG, ou rejoins une **table** pour agréger les commandes en temps réel.

Site : [sushi.martintech.fr](https://sushi.martintech.fr/)

## Structure

```
index.html          # shell UI
content/            # menu.json, seasons.json, version.json
css/                # main.css + seasons/
js/                 # app (menu, order, table, seasons, …)
assets/             # images, logos, sons
backend/            # FastAPI + SQLite + WebSocket
docker/             # entrypoint
```

## Déploiement Docker

```bash
git clone https://github.com/MartinTech63/Sushi.git
cd Sushi
cp .env.example .env   # optionnel
docker compose up -d --build
curl http://localhost:8000/health
```

La DB SQLite est dans le volume `sushi-data` (`/data/sushi.db` dans le conteneur).
Les JSON front sont servis sous `/content/` (pas le même chemin que la DB).

## Dev local

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Éditer la carte

Modifie [`content/menu.json`](content/menu.json) puis recharge la page.

Exemple d’item :

```json
{
  "id": "saumon",
  "code": "31",
  "name": "Saumon (2 pièces)",
  "image": "saumon.jpg",
  "max": 10
}
```

Glaces à parfums : utilise `"flavors": [{ "id": "chocolat", "label": "Chocolat" }, ...]`.
Place l’image dans `assets/`.

## Ajouter une saison (easter egg)

1. Ajoute une entrée dans [`content/seasons.json`](content/seasons.json) (`windows` en `MM-DD`).
2. Optionnel : CSS dans `css/seasons/`, effet dans `js/effects/`.
3. `toggle: true` affiche un interrupteur dans la popup d’accueil.

Saisons actuelles : **sakura** (pétales), **halloween** (thème + chauves-souris).
Les effets canvas respectent `prefers-reduced-motion`.

### Tester une saison (hors dates)

```
https://ton-site/?season=sakura
https://ton-site/?season=halloween
https://ton-site/?season=sakura,halloween
https://ton-site/?season=off
```

Ou en console : `SushiSeasons.force('halloween')` / `SushiSeasons.clearForce()`.

## Tables (API)

| Route | Rôle |
|--------|------|
| `POST /api/tables` | Créer une table |
| `POST /api/tables/join` | Rejoindre (reçoit `clientToken`) |
| `POST /api/tables/{code}/orders` | Envoyer commande (`Authorization: Bearer …`) |
| `WS /ws/{code}` | Summary live (`type: "summary"`) |
| `GET /health` | Liveness |
| `GET /ready` | DB OK |

Comportement UI : **envoi manuel** (bouton), **vue live auto** (WebSocket).

### Variables d’environnement

Voir [`.env.example`](.env.example) : `PORT`, `MAX_CLIENTS_PER_TABLE`, `WS_CONNECT_LIMIT`, etc.
`DATABASE_URL` / `DATABASE_PATH` = chemin fichier SQLite.

> Rate-limit et fan-out WS sont **in-memory** : un seul instance du conteneur.

## Reverse proxy (WebSocket)

Pense à transmettre `Upgrade` / `Connection` (Nginx) pour le live des tables.
