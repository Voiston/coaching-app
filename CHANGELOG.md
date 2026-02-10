## [v2.11] - PWA iOS, offline programmes & RPE UX
- **PWA / icônes :** Remplacement de l’icône inline du manifest par de vraies icônes `icon-192.png` / `icon-512.png` + ajout de `apple-touch-icon` pour un rendu propre sur l’écran d’accueil iOS.
- **Offline programmes :** Nouvelle stratégie de cache pour les fichiers `clients/*.json` dans `sw.js` : **Network First avec fallback cache** (les programmes restent disponibles hors ligne une fois chargés).
- **Install iOS :** Amélioration de `initInstallPrompt` : détection iOS, bannière spécifique avec instructions « Partager → Sur l’écran d’accueil », suppression du bouton d’installation non fonctionnel sur iOS.
- **RPE UX :** Slider RPE pré-rempli avec `rpe_target`, boule colorée du vert au rouge synchronisée avec la position, et étiquette RPE réalignée sous la boule.
- **Suivi poids :** Ajout du champ `baseline_weight_kg` côté JSON pour calculer les pourcentages d’objectif poids dans le header à partir du poids de base.

## [v2.10] - Suivi header v2, cuisses/bras, export/import, sécurité
- **Header suivi :** Maximum **3 suivis** affichés. Pourcentage **dans** la barre. Mise à jour en direct avec la valeur la plus récente (horodatage `recordedAt`, plusieurs le même jour = dernière enregistrée).
- **Mensurations :** Ajout **tour de cuisses** et **tour de bras** (formulaire, historique, objectifs header).
- **Paramètres :** **Exporter mes données** et **Importer une sauvegarde** (JSON, confirmation, rechargement).
- **Sécurité :** Échappement HTML (`escapeHtml`) pour tout contenu dynamique (XSS).
- **Documentation :** README (PWA, export/import, cuisses/bras), ARCHITECTURE, CHANGELOG.

## [v2.9] - Suivi header, objectifs & date du jour
- **Header suivi :** Possibilité d’afficher dans le header n’importe quelle mensuration (poids, tour de taille, tour de hanches, tour de poitrine) et le vêtement test. Préférences enregistrées (cases à cocher + objectifs en cm/kg).
- **Barre = % vers l’objectif :** La barre de progression est remplie en fonction du pourcentage atteint vers l’objectif (ex. 50 % = à mi-chemin). Gestion objectif en baisse (perte) ou en hausse (prise).
- **Date du jour :** Suppression des champs date dans l’éditeur de suivi ; mensurations, poids et vêtement test sont enregistrés automatiquement à la date du jour.
- **Poids & mensurations :** Aucune restriction à la baisse ; les valeurs peuvent à nouveau augmenter après avoir diminué (historique conservé, pas de blocage).

## [v2.8] - Compteurs & Auto-scroll Superset
- **Compteurs auto :** Comptage automatique des burpees, squats, pompes, fentes (en reps) et du temps passé en gainage (en secondes/minutes) à chaque série validée. Affichage des totaux dans la section « Compteurs » du panneau « Ma progression ».
- **Supersets :** Amélioration de l’auto-scroll en fin de superset : la vue se centre désormais sur le bloc de superset au lieu de descendre trop bas sur le 2ᵉ exercice.

## [v2.7] - UX Focus, RPE, Timers, Header
- **Modal RPE :** Affichée uniquement à la dernière série de l'exercice qui clôture le superset (pas en milieu de superset). Slider RPE plus fin (épaisseur ÷3). Style "clean girl" (pill exercice, overlay doux). Pas de hover sur le bouton ? RPE.
- **Timers :** Chrono de repos et chrono d'effort (compte à rebours) peuvent être mis en pause en cliquant dessus ; re-clic pour reprendre.
- **Header :** Titre "Bonjour [Prénom] !" et sous-titre centrés au milieu de l'écran (grille 3 colonnes avec spacer).
- **Mode Focus :** Passage automatique à l'exercice suivant à la fin de la dernière série (sans appuyer sur Suivant). Carte limitée en largeur sur PC (420px max), plein écran sur mobile.
- **Police :** Noms d'exercices en Josefin Sans.
- **Warm-up :** Cellule Warm-up en plus des séries (ne remplace plus une série). Modal échauffement sans emoji flamme, "Sans pause :" + pourcentages. Pas de notation RPE en fin d'échauffement.
- **Divers :** Bouton "Ajouter à mon agenda" uniquement dans le menu (supprimé en bas). Logo COACHING supprimé. Bouton imprimer et Copier le lien supprimés. Un seul mode Focus (Guidé fusionné).

## [v2.6] - Auto-scroll, Supersets 3+, Session intro, UX
- **Auto-scroll :** Quand tu coches la dernière série d'un exercice, la vue défile vers le prochain (après collapse, 1200 ms). Idem pour les supersets (après la 1ère série cochée).
- **Supersets 3+ exercices :** Circuits à 4 exercices ou plus : `start` → `middle` → `middle` → `end`. Cartes en colonne (pleine largeur) pour éviter l'étroit.
- **Session intro :** Champ JSON `session_intro` = encadré pastel en tête de séance (présentation, objectifs). Champ `coach_notes` sur les sections pour notes spécifiques.
- **Champ charge :** Libellé "Charge (kg)" permanent + suffixe « kg » pour plus de clarté quand pré-rempli.
- **Timer :** Bouton manuel masqué ; le chrono se déclenche uniquement au coche d'une série (flottant, texte agrandi).
- **Header :** Titre centré via grille. Bandeau orange hors ligne supprimé.
- **Encadré coach :** Couleur pastel lavande, police Poppins, emoji ampoule retiré.

## [v2.5] - Chrono Effort, Échauffement, Alternatives, RPE, Durée
- **Chrono d'Effort :** Exercices temps (reps "45s", "1 min") → bouton bleu "▶ Go" qui compte 0s, 1s, 2s...
- **Calculateur Échauffement :** Bouton 🔥 à côté de la charge → génère barre vide, 40%, 60%, 80% en modale.
- **Exercices Joker :** Champ JSON `alternative` → bouton 🔄 pour remplacer l'exercice (ex: Presse → Goblet Squat).
- **RPE visuel :** Bouton ? à côté du RPE (badge + input) → échelle colorée soignée, adaptée mobile.
- **Durée réelle séance :** Enregistrée (1er clic → Terminer) et ajoutée au rapport WhatsApp.
- **Chauffe vs Travail :** Champ `warmup_sets` → séries chauffe en carrés jaunes/pointillés, travail en cercles.
- **Charges pré-remplies :** Champ `charge` ou `default_charge` dans le JSON.
- **Détails dynamiques :** reps/rest en tableaux → affichage adapté à la série en cours (ex: "Série 2/4").
- **Bouton Terminer :** Déplacé en bas de page (non flottant). Ma progression après Imprimer.

## [v2.4] - Nutrition, Sanctuaire Récup & Chrono Flottant
- **Carte Nutrition Post-Workout :** Si une séance possède `"nutrition_tip"` dans le JSON, un conseil nutritionnel personnalisé s'affiche dans la modale de fin (encadré vert avocat 🥑).
- **Sanctuaire de Récupération :** Sur les jours de repos, bouton « Lancer ma routine Récupération (10min) » ouvrant une vidéo YouTube (URL par défaut ou `recovery_url` dans le JSON).
- **Chronomètre flottant :** Le chrono de repos reste visible en bulle fixe (bottom-right) pendant le défilement. Bouton × pour l'arrêter.

## [v2.3] - UX Header, chrono auto & supersets
- **Header :** Sur **desktop**, titre centré, boutons (Copier le lien, Focus, Mode sombre, Paramètres) décalés à droite. Sur **mobile**, menu ⋯ qui ouvre un dropdown pour une interface épurée.
- **Bouton « Recommencer la séance » :** Déplacé en bas de page (après le contenu de la séance, avant le footer).
- **Chrono automatique :** Le chronomètre de repos se lance automatiquement lorsqu’on coche une série (en plus du lancement manuel).
- **Supersets :** Refonte avec bloc dédié (label « Superset », fond et bordure), affichage côte à côte des deux exercices pour une structure plus lisible.
- **Check ma technique :** Le bouton ouvre WhatsApp avec le message pré-rempli ; la cliente utilise l'icône caméra de WhatsApp pour joindre sa vidéo.

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