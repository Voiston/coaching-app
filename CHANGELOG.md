## [v2.5] - Chrono Effort, Échauffement, Alternatives, RPE, Durée
- **Chrono d'Effort :** Exercices temps (reps "45s", "1 min") → bouton bleu "▶ Go" qui compte 0s, 1s, 2s...
- **Calculateur Échauffement :** Bouton 🔥 à côté de la charge → génère barre vide, 40%, 60%, 80% en modale.
- **Exercices Joker :** Champ JSON `alternative` → bouton 🔄 pour remplacer l'exercice (ex: Presse → Goblet Squat).
- **RPE visuel :** Bouton ? à côté du RPE → infobulle colorée (vert 5-6, jaune 7-8, rouge 9-10).
- **Durée réelle séance :** Enregistrée (1er clic → Terminer) et ajoutée au rapport WhatsApp.
- **Chauffe vs Travail :** Champ `warmup_sets` → séries chauffe en jaune/pointillé, travail en rouge.

## [v2.4] - Nutrition, Sanctuaire Récup & Chrono Flottant
- **Carte Nutrition Post-Workout :** Si une séance possède `"nutrition_tip"` dans le JSON, un conseil nutritionnel personnalisé s'affiche dans la modale de fin (encadré vert avocat 🥑).
- **Sanctuaire de Récupération :** Sur les jours de repos, bouton « Lancer ma routine Récupération (10min) » ouvrant une vidéo YouTube (URL par défaut ou `recovery_url` dans le JSON).
- **Chronomètre flottant :** Le chrono de repos reste visible en bulle fixe (bottom-right) pendant le défilement. Bouton × pour l'arrêter.

## [v2.3] - UX Header, chrono auto & supersets
- **Header :** Sur **desktop**, titre centré, boutons (Copier le lien, Focus, Mode sombre, Paramètres) décalés à droite. Sur **mobile**, menu ⋯ qui ouvre un dropdown pour une interface épurée.
- **Bouton « Recommencer la séance » :** Déplacé en bas de page (après le contenu de la séance, avant le footer).
- **Chrono automatique :** Le chronomètre de repos se lance automatiquement lorsqu’on coche une série (en plus du lancement manuel).
- **Supersets :** Refonte avec bloc dédié (label « Superset », fond et bordure), affichage côte à côte des deux exercices pour une structure plus lisible.
- **Check ma technique :** Sur mobile, le bouton ouvre la caméra pour enregistrer une vidéo, puis propose le partage vers WhatsApp (Web Share API) ; sinon ouverture de WhatsApp avec le message pré-rempli.

## [v2.2] - Progression, paramètres & rappels
- **Stats & progression :** Barre de stats (séances ce mois, série de semaines, prochaine dans X j). Panneau "Ma progression" avec dernières charges enregistrées par exercice.
- **Objectif semaine :** Champ JSON `weeklyGoal` (ex: `3`) pour afficher "Objectif semaine : 2/3 séances".
- **Célébration :** Confettis à l’ouverture de la modale quand la séance est terminée à 100 %.
- **Mode focus :** Bouton pour réduire le calendrier et n’afficher que la séance.
- **Message pour le coach :** Champ libre dans la modale de fin, sauvegardé et inclus dans le message WhatsApp.
- **Rappel navigateur :** Option dans Paramètres "Rappel Séance aujourd'hui" ; notification une fois par jour si séance prévue.
- **Imprimer la séance :** Bouton pour lancer l’impression (Ctrl+P).
- **Exercices :** Champs optionnels `tempo`, `variation`, `until_failure` (ou `failure`) dans le JSON, affichés dans les cartes. **Check ma technique** : bouton ouvrant WhatsApp avec message pré-rempli (vidéo envoyée par la cliente).
- **Paramètres :** Modale (son du chrono, thème Clair/Sombre/Auto, effacer les données, rappels).
- **Hors ligne :** Bandeau "Tu es hors ligne — tes données sont enregistrées localement".
- **Version :** Numéro de version affichée dans le pied de page.

## [v2.1] - Améliorations UX, Accessibilité & PWA
- **Calendrier :** Affichage des jours passés (3 jours) en plus des 21 à venir. Séances terminées marquées par un badge ✓ (localStorage).
- **Chrono :** Son (bip) à la fin du temps de repos en plus de la vibration.
- **Modale de fin :** Piège de focus (Tab), fermeture à la touche Échap, sliders 0–10 pour les scores (Muscle, Cardio, Fatigue, Sommeil).
- **Bouton "Recommencer la séance" :** Décoche toutes les séries sans recharger la page.
- **Erreurs :** En cas de programme introuvable ou JSON invalide, le header est conservé et un message clair s’affiche dans la zone principale. Validation des dates (format AAAA-MM-JJ).
- **Accessibilité :** aria-labels, rôles, fermeture clavier de la modale, accordéon au clavier (Entrée/Espace).
- **Code :** Suppression des `console.log` de debug. Délégation d’événements (plus de `onclick` inline). Constantes `PAST_DAYS` et `DAYS_AHEAD`.
- **PWA :** Manifest et Service Worker pour mise en cache et installation sur écran d’accueil.
- **Documentation :** README (lien PROMPT.md, installation PWA). ARCHITECTURE (champs optionnels, schéma exercices).

## [v2.0] - L'Update "Agenda" 🗓️
- **Calendrier Roulant :** Remplacement du sélecteur par une frise calendaire horizontale affichant les 14 prochains jours (Dates réelles).
- **Planification Temporelle :** Le JSON supporte désormais des dates précises (`"2024-05-21"`). L'application détecte automatiquement la séance du jour.
- **Design Premium v2 :**
    - Cartes du calendrier avec effet "Glassmorphism" et ombres douces.
    - État "Active" avec gradient Rose Gold.
    - Animation "Check" ✅ pour les séances terminées (optionnel).
- **Gestion des Jours de Repos :** Affichage d'un écran "Repos" zen avec animation flottante si aucune séance n'est prévue le jour J.

## [v1.3] - Version "Pro UX"
- **Bilan de Séance :** Ajout d'un formulaire complet dans la modale de fin (Difficulté Musculaire, Cardio, Fatigue, Sommeil).
- **Sauvegarde Intelligente :** Les notes/charges sont sauvegardées, mais les cases à cocher se réinitialisent au rafraîchissement.
- **Design Checkboxes :** Remplacement des numéros par une icône "Check" (SVG) stylisée.
- **Auto-Collapse :** Les exercices se replient automatiquement quand la dernière série est validée.

## [v1.2]
- **Nouveau Design :** Thème "Premium" avec polices Playfair Display & Poppins.
- **Supersets Responsive :** Affichage côte à côte sur Desktop, empilé sur Mobile.
- **Mode Focus :** Les exercices fonctionnent en accordéon.
- **Structure :** Ajout des "Sections".

## [v1.0] - [v1.1]
- Lancement initial, Chrono, YouTube support.