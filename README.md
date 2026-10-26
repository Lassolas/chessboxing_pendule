# Pendule Chessboxing

Pendule d'échecs pour les combats de chessboxing, faite pour le club Paris Chessboxing. C'est une page web installable sur téléphone (PWA) qui marche hors ligne.

**En ligne :** https://lassolas.github.io/chessboxing_pendule/

## Fonctionnalités

- Accueil : 4 gros boutons, 5 rounds (4'30 par joueur), 7 (6'), 9 (7'30) et 11 (9'). Un clic lance l'écran de la pendule.
- Pas de couleurs d'avance : le premier joueur qui touche sa moitié prend les Noirs et l'horloge des Blancs démarre. Ensuite chacun touche sa moitié pour finir son coup ; gros bouton pause au milieu. Boussole dans la barre : appuyer et glisser à droite ou à gauche tourne les chiffres des deux pendules (lisibles depuis l'autre côté) (téléphone posé en travers), vers le haut ou le bas remet le face-à-face ; un simple appui passe d'une orientation à l'autre. Les chiffres suivent aussi l'inclinaison du téléphone (côté droit vers le bas = droite, côté gauche = gauche, debout = face-à-face ; posé à plat, rien ne change). L'orientation est gardée. En pause : ▶ CONTINUER, ♟ Round suivant ▶ (saute au prochain round d'échecs), ↺ Rejouer pour recommencer à zéro, ⌂ pour l'accueil (le combat est gardé : le bouton « ▶ CONTINUER » de l'accueil affiche les temps des Blancs et des Noirs et relance aussitôt la partie ; sa petite ✕ efface la partie en cours). Le round d'échecs s'arrête tout seul à la fin de son temps, sauf le dernier, qui dure jusqu'à la fin des pendules (même après un round sauté ou du temps ajouté). Pendant une pause libre (∞), le bouton du milieu devient « ▶ ♟ 2 » ou « ▶ 🥊 2 » pour lancer le round suivant.
- **♟ Échecs** (actif par défaut) : mode chessboxing, la partie est découpée en rounds de 3 min, avec comptes et options. Désactivé : pendule classique (4'30, 6', 7'30 ou 9'), sans rounds ni comptes.
- Options à cocher (« ? » pour l'explication) :
  - **Coup illégal** (case sous ♟, désactivée par défaut) : bouton drapeau rouge « Coup illégal » dans le coin de chaque moitié, côté centre. Un coup illégal = 1 compte, le fautif rejoue. Un petit « − » à côté du drapeau retire le dernier coup illégal signalé de ce côté (erreur de doigt).
  - **Anti-jeu** (sous ♟ : la case ✋ Compte 30″ ; activée, elle ajoute ⏱ Alerte, reliée au compte : toujours 10 s avant (5 s avant si le compte est sous 30″) et la ligne « Comptes max − 3 + / round − 4 + total ») : alerte à 20 s, compte de 10 s dès 30 s, montré par deux mains d'arbitre (manchettes) qui replient un doigt par seconde, de 10 à 0, sans chiffres, puis partie perdue (« Continuer quand même » possible). Chaque compte à rebours = 1 compte ; 3 dans un round ou 4 au total, match perdu.
  - **⏸ Pause** : désactivée par défaut, la pause est libre (∞ : le coach relance). Activée : 1 min, réglable de 0″ (pas de pause, les rounds s'enchaînent) à 5', de 10 s en 10 s (comme les rounds d'échecs et de boxe).
  - **🥊 Boxe** : un round de boxe chronométré entre deux pauses. Sans boxe, la pause mène directement au round d'échecs suivant.
  - **Éco** : pas de son (vibrations seulement), écran plus sombre, pas d'animations.
- En pause et en fin de partie, chaque côté affiche son temps moyen par coup (⌀ 12,4 s / coup).
- Fin de partie : écran sombre, le côté et la couleur du vainqueur en doré, ⚑ chez le perdant.
- Sons analogiques uniquement : coup de poing enregistré mêlé au déclic d'une vieille pendule mécanique à chaque appui (6 variantes tirées au hasard, sons libres de droits Pixabay), cloche de boxe métallique et brillante (1 coup au début, 3 à la fin), marteau sur bois dur enregistré à 10 s de la fin (3 coups en 0,5 s pendant un round, 3 coups à 1 s d'intervalle pendant la pause), toc sur le bois pour l'alerte, porte qui se ferme en fin de partie. « Test son » dans ⚙ les fait tous entendre.
- Le temps de réflexion repart à zéro après la boxe. Chaque alerte a toujours un son et un changement de couleur.
- Écran toujours allumé, hors ligne, clavier ou bouton Bluetooth (Espace = pause, Entrée = coup joué).
- Sous les 4 boutons : ♟ Échecs, ⏸ Pause, 🥊 Boxe. Appui sur une case : active ou désactive. Bande de droite : la valeur, à régler en glissant le doigt (vers le bas = plus, comme une roue). Le temps par joueur suit la durée du round d'échecs (5 rounds de 2' = 3'00 chacun). « ↺ Réinitialiser » remet les valeurs par défaut.
- « Style » (pinceau) (menu déroulant en bas) : 🔊 Son (activé par défaut) et 🔋 Éco en boutons icônes, et trois cases « 4:30 » pour choisir les chiffres de la pendule : Oxanium (par défaut), DGT (segments LCD comme une pendule DGT, dessinés en SVG) ou Teko.
- « ⚙ Réglages » : test des sons et valeurs par défaut. Pas de noms de joueurs : BLANCS / NOIRS seulement.

## Installer

Ouvre le lien sur le téléphone. Android : bouton « Installer l'appli ». iPhone : Partager puis « Sur l'écran d'accueil ».

## Développer

Aucune dépendance. `npm run dev` sert la page sur http://localhost:8000, `npm test` vérifie la logique de la pendule (`clock.js`). Quand les fichiers changent, augmenter `VERSION` dans `sw.js` pour que les téléphones prennent la nouvelle version.

## Crédits

Sons de coups : « Punch sound » de storegraphic sur Pixabay (licence Pixabay, utilisation libre).
Son du claquoir : « Hammering » de Dragon Studio sur Pixabay (licence Pixabay, utilisation libre), découpé en 6 coups.

## Licence

Application créée par **Chessboxing Paris**. © 2026 Chessboxing Paris, sous licence MIT (voir LICENSE). Le logo du club apparaît en tête de l'accueil, en bas avec les crédits, et en filigrane derrière l'accueil et la pendule (`logo.png`, `logo-wide.png`, `logo-glove.png`).
