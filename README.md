# 🏋️‍♀️ Coaching App - Digital Workout Tracker

Une application web de suivi sportif "No-Code" & "No-Backend", offrant une expérience **Premium** proche d'une application native.

🔗 **Concept :** Chaque client a son URL unique. L'application agit comme un **Agenda Sportif** intelligent.

## ✨ Fonctionnalités Clés

* **📅 Calendrier :** Jours passés + 21 jours à venir, séance du jour détectée, jours de repos avec écran dédié. Nom de la séance sous chaque jour. Semaine courante et « Prochaine séance » affichées.
* **📱 Interface :** Titre "Bonjour [Prénom] !" et sous-titre centrés. Menu ⋯ (Agenda, Focus, Mode sombre, Paramètres). Mode Focus : un exercice à la fois, plein écran sur mobile, largeur limitée sur PC ; passage auto à l'exercice suivant en fin de série.
* **🏋️ Séance :** Exercices en accordéon, **chronomètre de repos** (lancé automatiquement quand tu coches une série). **Supersets** (2 exercices côte à côte, 3+ en colonne). Auto-scroll vers le prochain exercice à la dernière série cochée.
* **📹 Check ma technique :** Si l'exercice a `"check_technique": true`, un bouton ouvre WhatsApp avec un message pré-rempli ; la cliente utilise ensuite l'icône caméra pour envoyer sa vidéo.
* **🥑 Carte Nutrition :** Si la séance a `"nutrition_tip"`, un conseil nutritionnel s'affiche dans la modale de fin.
* **🧘‍♀️ Sanctuaire Récupération :** Les jours de repos affichent un bouton pour lancer une vidéo stretching (URL par défaut ou `recovery_url`).
* **⏱️ Chronos :** Repos (lancé au coche d'une série) et effort (compte à rebours) ; clic sur le chrono pour mettre en pause / reprendre. Bouton × pour arrêter le repos.
* **🔥 Échauffement :** Cellule "Warm-up" avant les séries (si `warmup_sets`). Modal avec "Sans pause :" + 40%, 60%, 80% puis charge de travail.
* **🔄 Alternatives :** Champ `alternative` → bouton pour remplacer l'exercice (machine prise).
* **📊 RPE :** Échelle 1/2 à 9/10 (tooltip ?). À la dernière série (hors échauffement et hors milieu de superset), modal "Comment c'était ?" avec slider vert→rouge. Données dans le rapport WhatsApp.
* **📈 Ma progression :** Panneau latéral avec dernières charges par exercice, 1RM théoriques (Epley), volume total, badges, et **compteurs automatiques** (burpees, squats, pompes, fentes, temps de gainage) incrémentés à chaque série validée.
* **📏 Suivi & objectifs :** Mensurations (taille, hanches, poitrine, cuisses, bras), poids et vêtement test enregistrés à la **date du jour** (sans champ date dans l’éditeur). Dans le header, barre de progression vers l’objectif pour **poids, taille, hanches, poitrine, cuisses ou bras** (max. 3 dans le header, % dans la barre, valeur la plus récente) ; affichage optionnel du vêtement test. Les valeurs peuvent augmenter ou diminuer librement dans le temps.
* **🧠 Données locales :** Charges et notes sauvegardées (localStorage). **Export / Import** des données dans Paramètres (sauvegarde JSON, restauration avec confirmation). Champ charge avec libellé et suffixe « kg ». Séances terminées marquées d’un ✓. Bouton « Recommencer la séance » en bas de page pour tout décocher.
* **⚡️ Bilan & partage :** Modale de fin avec scores (sliders), message libre pour le coach. Export **WhatsApp** formaté. Paramètres (son, thème clair/sombre/auto, rappels, exporter/importer les données, effacer les données). PWA.

## 📲 Installation (PWA)
Sur mobile, ouvre l’app dans Chrome/Edge, puis **Menu → Installer l’application** (ou **Ajouter à l’écran d’accueil**). L’app peut alors être utilisée hors ligne pour les pages déjà visitées.

Sur **iPhone (Safari)** :
- Ouvre le lien client.
- Appuie sur le bouton **Partager**.
- Choisis **« Sur l’écran d’accueil »** pour ajouter l’icône de l’app (icône dédiée via `apple-touch-icon`).

**Important :** La première ouverture doit se faire via le **lien avec `?client=…`** (ex. `https://ton-site.github.io/coaching/?client=julie`). Le programme est alors mémorisé ; en ouvrant ensuite l'app depuis l'icône PWA (sans `?client=` dans l'URL), le bon programme s'affiche automatiquement.

## 🛠 Comment l'utiliser (Pour le Coach)

1.  Créer un fichier `.json` dans le dossier `/clients` (ex: `julie.json`).
2.  **Planifier :** Utiliser le format `YYYY-MM-DD` pour assigner les séances aux jours réels.
3.  Utiliser le **Générateur IA** (voir `PROMPT.md`) pour gagner du temps.
4.  Envoyer le lien à la cliente : `?client=julie`.

## 📱 Comment l'utiliser (Pour la Cliente)

1.  Ouvre le lien. Le jour du jour est mis en avant ; si une séance est prévue, elle s’affiche.
2.  Coche tes séries ✅ (le chrono de repos se lance automatiquement après chaque série, ou lance-le à la main).
3.  Note tes charges et RPE. Pour « Check ma technique », ouvre WhatsApp puis utilise l'icône caméra pour envoyer ta vidéo.
4.  En fin de séance, valide le bilan dans la modale et envoie le rapport au coach. Le bouton « Recommencer la séance » en bas permet de tout décocher pour refaire la séance.
5.  Scrolle le calendrier pour voir les autres jours et séances.

## 🚀 Déploiement (GitHub Pages)
Pour que l’app et la PWA fonctionnent, ces fichiers doivent être à la **racine** du site (ou du dossier servi par GitHub Pages) :
- `index.html`, `style.css`, `script.js`, `manifest.json`, `sw.js`
- le dossier `clients/` avec tes fichiers `.json`
- les icônes `favicon.svg`, `icon-192.png`, `icon-512.png`

Si tu vois une erreur *manifest.json failed, 404*, c’est que `manifest.json` n’est pas présent sur le dépôt déployé : ajoute-le, commite et pousse sur la branche utilisée par GitHub Pages.

---
*Architecture 100% Statique (HTML/JS/JSON) - Hébergeable gratuitement sur GitHub Pages.*