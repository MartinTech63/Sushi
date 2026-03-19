# Améliorations proposées – Manger des Sushis 

## 1. Nettoyage du code

| Action | Fichier | Raison |
|--------|---------|--------|
| **Supprimer ou archiver** | `scripts.js` (à la racine) | Non chargé dans `index.html` : toute la logique est dans `SCRIPTS/`. Ce fichier est du code mort et peut prêter à confusion. |
| **Réduire les `console.log`** | `SCRIPTS/id.js` | `console.log("Updated Order ID:", orderId)` à chaque changement : utile en dev, bruyant en prod. Option : supprimer ou conditionner à un mode debug. |

---

## 2. Accessibilité (a11y)

- **Popup**  
  - Ajouter `role="dialog"` et `aria-modal="true"` sur le conteneur de la popup.  
  - Piéger le focus à l’intérieur à l’ouverture (tab ne sort pas de la popup).  
  - Remettre le focus sur l’élément qui a ouvert (ou sur le premier lien du menu) à la fermeture.  
  - Donner un `aria-label` ou un titre visible pour les lecteurs d’écran.

- **Liens externes**  
  - Pour tous les liens avec `target="_blank"` (GitHub, partage), ajouter `rel="noopener noreferrer"` pour la sécurité et les bonnes pratiques.

- **Boutons d’action**  
  - Les boutons flottants (haut de page, commande, reset) ont déjà `title` ; vérifier qu’ils sont bien atteignables au clavier (tab) et qu’ils ne sont pas masqués par le canvas (z-index déjà géré).

---

## 3. UX

- **Confirmation avant reset**  
  - Au clic sur « Réinitialiser la commande », afficher une confirmation du type :  
    « Êtes-vous sûr de vouloir réinitialiser toute la commande ? »  
  - Évite les réinitialisations accidentelles.

- **Son du logo**  
  - `playSound()` peut être bloquée par la politique autoplay. Appeler `.play().catch(() => {})` pour éviter une erreur non gérée dans la console si l’utilisateur n’a pas encore interagi.

- **Partage**  
  - Le long `onclick` inline du lien « Partager ce site » peut être déplacé dans un petit script (ex. `SCRIPTS/share.js`) pour un HTML plus lisible et plus facile à maintenir.

---

## 4. HTML / structure

- **Styles inline**  
  - Déplacer les styles inline (header, nav, popup, footer, etc.) vers `styles.css` en utilisant des classes (ex. `.site-header`, `.popup-meta`) pour centraliser le style et faciliter les thèmes (dont Halloween).

- **Script inline (logo + partage)**  
  - Le script qui gère le changement de logo selon le thème (MutationObserver) et éventuellement la logique de partage peuvent être déplacés dans un fichier JS dédié (ex. `SCRIPTS/logo-theme.js`), chargé en `defer`, pour garder le HTML plus propre.

---

## 5. CSS

- **Doublons**  
  - `.menu-item` (et `.menu-section`) sont définis plusieurs fois avec des propriétés qui se chevauchent. Fusionner en un seul bloc par sélecteur pour éviter les conflits et simplifier les overrides (ex. Halloween).

- **Commentaires**  
  - Remplacer ou supprimer le commentaire « test boutons » par une description claire (ex. « Boutons de sélection et accessibilité »).

---

## 6. Robustesse JS

- **Canvas (pétales)**  
  - Dans `petales.js`, vérifier que `document.getElementById('petalsCanvas')` et `canvas.getContext('2d')` existent avant de les utiliser, pour éviter une erreur si l’ordre des scripts ou le DOM change.

- **Génération du PNG (commande)**  
  - Dans `commande.js`, l’image du logo est chargée en async (`logo.onload`). Si le fichier est en 404 ou lent, le téléchargement du PNG peut ne jamais se déclencher. Ajouter un `logo.onerror` (et éventuellement un timeout) pour soit afficher un message, soit générer l’image sans logo (rectangle de remplacement ou texte « Logo »).

- **Popup**  
  - Vérifier que `document.getElementById("popupOverlay")` existe avant d’accéder à `.style` ou `.classList`, pour éviter une erreur si le HTML est modifié.

---

## 7. Performance (optionnel)

- **MutationObserver** (`select-ui.js`)  
  - L’observer écoute tout `document.body` avec `subtree: true`. Si le DOM devient très gros, on peut restreindre l’observation à un conteneur donné (ex. `#main` ou `.container`) pour limiter le nombre de notifications.

- **Scroll / resize**  
  - Les handlers `adjustButtonPosition` (ui.js) et scroll pour le bouton « haut de page » peuvent être légèrement debouncés (ex. 50–100 ms) pour réduire les recalculs sur mobile ou sur fenêtre redimensionnée rapidement. À tester au besoin.

---

## 8. Fonctionnalité « Order ID » (`id.js`)

- `generateOrderId()` et la variable `orderId` ne sont utilisées nulle part dans l’interface (seulement `console.log`).  
- **Options** :  
  - Soit exposer l’ID dans l’UI (ex. affiché dans la popup ou sur le PNG de commande) pour identifier la commande.  
  - Soit retirer ou commenter le code et le `console.log` si la feature n’est pas prévue à court terme.

---

## Résumé des actions à fort impact / peu d’effort

1. Supprimer ou ne plus maintenir `scripts.js` (ou le documenter comme obsolète).  
2. Ajouter `rel="noopener noreferrer"` sur les liens `target="_blank"`.  
3. Confirmation avant réinitialisation de la commande.  
4. Sécuriser `playSound()` avec `.catch(() => {})`.  
5. Vérifications d’existence (canvas, popup, logo) pour éviter les erreurs en cas de changement du HTML ou des ressources.

Si tu veux, on peut détailler l’implémentation d’une de ces améliorations (par exemple la confirmation de reset ou le nettoyage de `scripts.js`).
