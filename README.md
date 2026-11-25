# Menus : préparer ses menus à l'avance (usage personnel)

Appli web installable (PWA), sans serveur ni compte. Les idées de plats et les menus sont dans de simples fichiers JSON (`data/`), versionnés dans ce dépôt. Fonctionne hors-ligne après la première ouverture.

## Publier (GitHub Pages)

1. Crée le dépôt GitHub `menus-familiaux` (public : GitHub Pages gratuit l'exige, les menus seront donc lisibles par tous) et pousse ce dossier.
2. Dépôt > Settings > Pages > Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. L'appli est à `https://blandineroustan.github.io/menus-familiaux/`. Sur le téléphone : « Ajouter à l'écran d'accueil ».

Mise à jour du code : les changements apparaissent au 2e lancement (ou augmente `V` dans `sw.js`).

## Utilisation

- **Menus** : à partir d'aujourd'hui, en vue **Semaine** (7 jours) ou **4 semaines**. Les flèches avancent ou reculent (on retrouve ainsi l'historique). Chaque jour affiche son nom (lundi, mardi…) et sa date.
  - Touche un repas pour l'éditer. Il a quatre lignes, toutes facultatives : **Entrée**, **Plat**, **Salade**, **Dessert**. Choisis la ligne, puis cherche dans les idées ou tape un nouveau nom et Entrée pour l'ajouter aux idées. Plusieurs mets par ligne possibles, plus une note (« Restes », « Repas dehors »…). Les flèches de l'éditeur passent au jour précédent / suivant : pratique pour remplir 4 semaines d'affilée.
  - Dans le planning, les mets s'affichent dans l'ordre entrée, plat, salade, dessert, avec une couleur par service : moutarde (entrée), vert sapin (plat), vert tendre (salade), rose poudré (dessert).
  - **Souvent avec…** : dès qu'un mets est choisi, les suggestions commencent par ce qui a déjà accompagné ce mets dans le service sélectionné, calculé sur les menus existants (ex. Bourguignon → Pommes de terre vapeur 2×, Riz 1× ; Pizza → Salade verte en salade). Plus on remplit de menus, plus c'est pertinent.
  - Ensuite viennent les mets déjà servis dans ce service (ou jamais servis), puis « Jamais servis en … » avec le service habituel du mets. Dans chaque groupe, on fait tourner : d'abord ceux servis il y a le plus longtemps, en fin de liste ceux servis ou prévus à moins de 14 jours (⚠, réglable). Dans le planning, un mets trop proche d'une autre occurrence est marqué ↻ (bordure orange).
  - Le **soir** est toujours « à prévoir ». Le **midi** ne l'est que les mercredis, samedis et dimanches (jours modifiables dans les réglages), pendant les vacances scolaires et les jours fériés ; sinon il reste discret (restes), mais on peut quand même le remplir.
  - Vacances scolaires de l'académie de Toulouse (bande orangée, nom des vacances) et jours fériés. Pour une autre académie : constante `ACADEMIE` dans `js/calendrier.js`.
- **Idées** : liste des mets, recherche, ajout, tri « à ressortir » (les moins récemment servis d'abord). Chaque idée indique comment elle a été servie jusqu'ici (« Entrée 2 », « Plat 5 »…), calculé d'après les menus : on voit ce qui sert d'entrée, de plat, ou des deux. Filtres Entrées / Plats / Salades / Desserts / Jamais servies. Touche une idée pour la renommer, voir avec quoi elle est « souvent servie », son historique (date, repas, service), ou l'archiver (elle n'est plus proposée mais reste dans l'historique).
- **Réglages** : midis à prévoir, mise à jour du calendrier des vacances, délai anti-répétition, sauvegarde.

## Données et sauvegarde

L'appli travaille sur une copie dans le navigateur, et part des fichiers `data/*.json` du dépôt à chaque ouverture (fusion). Un bouton orange « À sauvegarder » apparaît dès qu'une modification n'est pas encore sauvegardée.

- **Envoyer sur GitHub (direct)** : un commit dans `data/` à chaque envoi. Il faut un jeton personnel, à créer sur GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens : accès au seul dépôt `menus-familiaux`, permission « Contents : Read and write ». Colle-le dans Réglages > Sauvegarde ; il reste sur l'appareil (jamais dans le dépôt). À l'ouverture, l'appli récupère aussi le dépôt : on peut alterner téléphone et ordinateur.
- **Par fichiers** : « Télécharger les 3 fichiers », à déposer dans `data/` puis commit. « Importer » fait l'inverse.
- **Fusion** : chaque plat et chaque jour porte une date de modification (`maj`) ; à la fusion, la plus récente gagne. Rien n'est perdu en repartant d'un ancien fichier.

## Format des fichiers

Une ligne par élément, pour des diffs git lisibles.

`data/plats.json` : les idées.
```json
{"id": "pates-carbo", "nom": "Pâtes carbo", "ingredients": [], "maj": "…"}
```
`archive: true` = plus proposé. `ingredients` : prévu pour la v2, liste de `{"id": "pates"}` renvoyant à `data/ingredients.json`.

`data/menus.json` : les menus, jour par jour (passé = historique). `entrees`, `plats`, `salades`, `desserts` et `note` sont tous facultatifs. Le service n'est pas une propriété du mets : il dépend du menu, si bien qu'une quiche peut être une entrée un jour et un plat un autre.
```json
"2026-11-25": {"midi": {"note": "Restes"}, "soir": {"entrees": ["carottes-rapees"], "plats": ["bourguignon"], "desserts": ["compote"]}, "maj": "…"}
```

`data/ingredients.json` : types d'ingrédients (féculent, légume, protéine…) et ingrédients, pour la v2 (équilibre des féculents, liste de courses).

## Idées pour la suite

- v2 : ingrédients par plat avec leur type, repères visuels (féculents sur la semaine), liste de courses.
- Variantes d'un plat : des idées distinctes au nom commun, ex. « Pizza (raclette) », « Pizza (jambon fromage) » (la recherche « pizza » les trouve toutes).
- Dupliquer une semaine, glisser-déposer un plat d'un jour à l'autre.

## Fichiers

```
index.html  manifest.json  sw.js
css/style.css
js/  app.js (onglets, démarrage)  planning.js (vues, éditeur)  idees.js  reglages.js
     donnees.js (copie locale, fusion, fichiers)  github.js (API)  calendrier.js (vacances, fériés)
     dates.js  ui.js
data/  plats.json  menus.json  ingredients.json
tools/icones.mjs  (régénère icons/ : node tools/icones.mjs)
```

Tester en local : `python3 -m http.server 8000` puis http://localhost:8000.
