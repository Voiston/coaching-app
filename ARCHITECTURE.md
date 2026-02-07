# 🏗 Architecture & Structure des Données

Ce projet fonctionne sur une architecture **Statique** (HTML/CSS/JS) alimentée par des fichiers de données **JSON**.

## 📂 Arborescence
.
├── index.html       # Structure, header (logo / titre / actions), calendrier, main, modales, footer
├── style.css        # Design (Thème Rose Gold), responsive (menu ⋯ mobile, supersets côte à côte)
├── script.js        # Logique (Calendrier, JSON, Chrono auto, WhatsApp, Check technique caméra, PWA)
├── manifest.json    # PWA : nom, thème, mode standalone
├── favicon.svg      # Icône onglet
├── sw.js            # Service Worker (cache hors ligne)
└── clients/         # Dossier contenant les programmes
    ├── demo.json    # Fichier exemple (structure multi-séances)
    └── clientX.json # Fichiers clients individuels

## 🖥 Interface (résumé)
- **Header :** Zone gauche (logo), centre (titre + sous-titre centrés), droite (boutons sur desktop ; menu ⋯ sur mobile avec dropdown).
- **Calendrier :** Frise horizontale avec jours passés + à venir, nom court de la séance sous la date, badge ✓ pour les séances terminées.
- **Séance :** Cartes exercices en accordéon. Supersets regroupés dans un bloc avec label « Superset », deux cartes côte à côte sur desktop. Chrono de repos lancé automatiquement au coche d’une série. Bouton « Recommencer la séance » en bas de page.

## 📝 Structure du fichier JSON (Règles strictes v2.0)

Le fichier client ne contient plus une liste d'exercices à la racine, mais une liste de **séances** (`sessions`) datées.

### Les Champs Clés (séance)
* `sessions`: Tableau contenant les différentes séances.
* `date`: **OBLIGATOIRE** (format v2). Format strict **"AAAA-MM-JJ"** (Ex: "2024-05-21"). C'est ce qui permet d'afficher la séance le bon jour sur le calendrier.
* `id`: Identifiant unique pour la sauvegarde des charges et l'état "séance terminée" (ex: "s1_legs").
* `name`: Nom affiché de la séance (ex: "🍑 Jambes & Fessiers").
* `exercises`: Tableau d'exercices ou de sections.

### Champs optionnels (racine)
* `clientName`: Prénom du client (affiché en en-tête).
* `programTitle`: Titre du programme (sous-titre).
* `weeklyGoal`: Nombre de séances cibles par semaine (ex: `3`). Affiche un bandeau "Objectif semaine : X/Y séances".
* `recovery_url`: URL YouTube pour la routine de récupération/stretching affichée les jours de repos.

### Champs optionnels (session)
* `nutrition_tip`: Conseil nutritionnel affiché dans la modale de fin de séance (ex: "Dans les 30 min post-workout, mange des protéines + glucides.").

### Champs optionnels (exercice)
* `type`: Si `"section"`, l'entrée est un titre de phase (`title` obligatoire), pas un exercice.
* `name`: Nom de l'exercice.
* `sets`, `reps`, `rest`: Séries, répétitions, temps de repos (affichage libre, ex: "4", "6-8", "90s").
* `rpe_target`: RPE cible (affiché dans un badge).
* `image`: URL d'une image ou lien YouTube/youtu.be (bouton "Voir la démo vidéo" ou image).
* `note_coach`: Citation ou consigne du coach (affichée sous les séries).
* `superset_type`: `"start"` pour le premier exercice d'un superset, `"end"` pour le dernier (affichage côte à côte sur desktop).
* `tempo`: Tempo de l'exercice (ex: `"3-1-2-0"`), affiché dans la grille de détails.
* `variation`: Variante ou précision (ex: "pieds larges"), affichée sous le titre.
* `until_failure` ou `failure`: Si présent, affiche "Jusqu'à échec" à la place des reps.
* `check_technique`: Si `true`, affiche un bouton "Check ma technique" ouvrant WhatsApp avec un message pré-rempli.
* `alternative`: Nom ou objet de l'exercice alternatif (ex: `"Goblet Squat"`). Bouton 🔄 pour remplacer.
* `warmup_sets`: Nombre de séries d'échauffement. Les premières cases sont en jaune/pointillé.
* Reps temps (`"45s"`, `"1 min"`) → bouton "▶ Go" chrono d'effort qui compte à l'endroit.

### Exemple complet de JSON (v2.0)
```json
{
  "clientName": "Julie",
  "programTitle": "Cycle Force - Semaine 1",
  "sessions": [
    {
      "id": "s1_lundi",
      "date": "2024-05-20",      <-- La séance apparaîtra à cette date précise
      "name": "🍑 Jambes & Fessiers",
      "exercises": [
        {
          "type": "section",
          "title": "Échauffement"
        },
        {
          "name": "Squat",
          "superset_type": "start",
          "image": "lien_youtube",
          "sets": "4",
          "reps": "10",
          "rest": "90s",
          "rpe_target": "8"
        }
      ]
    },
    {
      "id": "s1_mercredi",
      "date": "2024-05-22",
      "name": "💪 Haut du corps",
      "exercises": [ ... ]
    }
  ]
}