# DeliTrack - Suivi de Livraisons (Projet 6)

Résumé du dépôt et état actuel

- Services présents et scaffolds créés:
  - `auth-service` : gestion utilisateurs, JWT, MongoDB, endpoints `/auth/register`, `/auth/login` (fichier: `auth-service/index.js`).
  - `client-service` : proxy/endpoint pour clients (création de demande, consultation), `client-service/index.js`.
  - `livraison-service` : gestion des livraisons (création, assignation, changement de statut), publie événements RabbitMQ sur l'exchange `delivery.status` (`livraison-service/index.js`).
  - `notification-service` : consumer RabbitMQ qui écoute `delivery.status` et log les notifications (`notification-service/index.js`).

- Orchestration:
  - `docker-compose.yml` : MongoDB, RabbitMQ (management), et build des services ci‑dessus.
  - `DeliTrack.postman_collection.json` : collection Postman v2.1 avec scénarios et tests automatiques.

Fichiers ajoutés / modifiés

- `livraison-service/` : `package.json`, `index.js`, `Dockerfile`
- `client-service/` : `package.json`, `index.js` (proxy)
- `notification-service/` : `package.json`, `index.js`, `Dockerfile`
- `docker-compose.yml`

Ports exposés (local)

- `auth-service`: 4002
- `client-service`: 3002
- `livraison-service`: 3003
- `notification-service`: 3004
- `mongo`: 27017
- `rabbitmq management`: 15672 (UI)

Routes ajoutées ou corrigées

- `POST /clients/deliveries` : création de livraison, rôle `client` uniquement.
- `GET /clients/deliveries/moi` : livraisons du client connecté.
- `GET /clients/deliveries/:id` : détail d'une livraison.
- `GET /deliveries/client/:clientId` : toutes les livraisons d'un client, rôle `client` ou `gestionnaire`.
- `GET /deliveries/:id` : détail complet d'une livraison avec historique.
- `POST /deliveries/:id/assign` : assignation, rôle `gestionnaire` uniquement.
- `PATCH /deliveries/:id/status` : changement de statut, rôle `livreur` uniquement, avec ajout dans `historique`.

Comment le flux fonctionne

1. Un client s'inscrit et se connecte via `auth-service` (`/auth/register`, `/auth/login`). Le token JWT contient `id`, `email`, `nom`, `role`.
2. Le client crée une demande de livraison via `client-service` (proxy vers `livraison-service`).
3. Le gestionnaire assigne une livraison via `livraison-service` (`/deliveries/:id/assign`).
4. Le livreur met à jour le statut via `livraison-service` (`/deliveries/:id/status`).
5. `livraison-service` publie un message sur l'exchange RabbitMQ `delivery.status` à chaque changement de statut.
6. `notification-service` consomme ces messages et affiche (ou enverrait) des notifications.

Historique traçable

- Le modèle de livraison contient maintenant `historique: [{ statut, date, commentaire }]`.
- À chaque changement de statut, une nouvelle entrée est ajoutée à `historique` en plus de la mise à jour du statut courant.

Exemples de commandes (curl) — flux de test

1) Inscription d'un utilisateur (client):

```bash
curl -sS -X POST http://localhost:4002/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nom":"Alice","email":"alice@example.com","role":"client","mot_passe":"pass123"}'
```

2) Connexion (récupérer token):

```bash
curl -sS -X POST http://localhost:4002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","mot_passe":"pass123"}'
# réponse: { "token": "..." }
```

3) Créer une livraison (client) — utiliser le token:

```bash
curl -sS -X POST http://localhost:3002/clients/deliveries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"pickup": {"address":"A"}, "dropoff": {"address":"B"}}'
```

4) Assigner (gestionnaire):

```bash
# se connecter avec un compte role=gestionnaire pour obtenir TOKEN_GEST
curl -X POST http://localhost:3003/deliveries/<DELIVERY_ID>/assign \
  -H "Authorization: Bearer <TOKEN_GEST>" \
  -H "Content-Type: application/json" \
  -d '{"livreurId":"<LIVREUR_ID>"}'
```

5) Changer le statut (livreur):

```bash
curl -X PATCH http://localhost:3003/deliveries/<DELIVERY_ID>/status \
  -H "Authorization: Bearer <TOKEN_LIVREUR>" \
  -H "Content-Type: application/json" \
  -d '{"status":"en_route"}'
```

6) Vérifier notifications:

```
# Ouvrir les logs du container notification-service (ou la console où il tourne)
docker-compose logs -f notification-service
```

Comment démarrer (Docker)

```bash
docker-compose up --build
```

Alternativement démarrage manuel (chaque service):

```bash
# Exemple pour auth-service
cd auth-service
npm install
npm run dev

# Répéter pour les autres services (livraison-service, client-service, notification-service)
```

Variables d'environnement importantes

- `JWT_SECRET` : clé pour signer/valider les JWT (actuellement `secret` dans `docker-compose.yml`, à sécuriser en prod)
- `MONGO_URL` : URI MongoDB
- `AMQP_URL` : URI RabbitMQ

Limitations / points à améliorer

- Pas de collection Postman incluse (je peux la générer sur demande).
- Pas de tests automatisés (Postman/Newman ou Jest) dans le dépôt — à ajouter.
- La validation des inputs et la gestion des erreurs peuvent être renforcées.
- Secrets à extraire (ne pas garder `secret` en dur pour la prod).
- Auth et gestion des rôles sont basiques; envisager un package commun pour partager le middleware.

Si vous voulez, je peux maintenant :

- Générer une collection Postman (scénarios automatisés).
- Ajouter des tests Postman/Newman.
- Extraire le middleware JWT dans un petit package réutilisable.
