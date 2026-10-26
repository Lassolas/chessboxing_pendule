# Pendule Chessboxing

Pendule d'échecs pour les combats de chessboxing, faite pour le club Paris Chessboxing. C'est une page web installable sur téléphone (PWA) qui marche hors ligne.

**En ligne :** https://lassolas.github.io/chessboxing_pendule/

## Fonctionnalités

- Accueil : 4 gros boutons, 5 rounds (4'30 par joueur), 7 (6'), 9 (7'30) et 11 (9'). Un clic lance l'écran de la pendule.
- Pas de couleurs d'avance : le premier joueur qui touche sa moitié prend les Noirs et l'horloge des Blancs démarre. Ensuite chacun touche sa moitié pour finir son coup ; gros bouton pause au milieu. En pause : ▶ CONTINUER, ♟ Round suivant ▶ (saute au prochain round d'échecs), ↺ Rejouer (deux appuis) pour recommencer à zéro, ⌂ pour l'accueil (le combat est gardé : le bouton « ▶ CONTINUER » de l'accueil affiche les temps des Blancs et des Noirs et relance aussitôt la partie). Sans « Stop 3 min », le bouton devient STOP une fois le temps du round écoulé et lance la boxe.
- **Intervalles 3 min** (coché par défaut) : combat coaché avec rounds, comptes et les options ci-dessous. Décoché : pendule classique (4'30, 6', 7'30 ou 9'), sans rounds ni comptes.
- Options à cocher (« ? » pour l'explication) :
  - **Coups illégaux** (décoché par défaut) : carton jaune dans le coin de chaque moitié, côté centre. Un coup illégal = 1 compte, le fautif rejoue.
  - **Auto rounds** : le round d'échecs s'arrête tout seul à 3 min (sinon alerte, et le coach arrête).
  - **Anti-jeu** : alerte à 20 s, compte de 10 s dès 30 s, montré par deux mains d'arbitre (manchettes) qui replient un doigt par seconde, de 10 à 0, sans chiffres, puis partie perdue (« Continuer quand même » possible). Chaque compte à rebours = 1 compte ; 3 dans un round ou 4 au total, match perdu.
  - **Timer boxe** : la pause et le round de boxe sont chronométrés, puis les échecs repartent seuls.
  - **Éco** : pas de son (vibrations seulement), écran plus sombre, pas d'animations.
- En pause et en fin de partie, chaque côté affiche son temps moyen par coup (⌀ 12,4 s / coup).
- Fin de partie : écran sombre, le côté et la couleur du vainqueur en doré, ⚑ chez le perdant.
- Sons analogiques uniquement : coup de poing enregistré à chaque appui (6 variantes tirées au hasard, son libre de droits Pixabay), cloche de boxe métallique et brillante (1 coup au début, 3 à la fin), claquoir en bois dur (deux baguettes frappées) à 10 s de la fin (3 coups en 0,8 s pendant un round, 3 coups à 1 s d'intervalle pendant la pause), toc sur le bois pour l'alerte, porte qui se ferme en fin de partie. « Test son » dans ⚙ les fait tous entendre.
- Le temps de réflexion repart à zéro après la boxe. Chaque alerte a toujours un son et un changement de couleur.
- Écran toujours allumé, hors ligne, clavier ou bouton Bluetooth (Espace = pause, Entrée = coup joué).
- Noms et durées modifiables dans « ⚙ Réglages ».

## Installer

Ouvre le lien sur le téléphone. Android : bouton « Installer l'appli ». iPhone : Partager puis « Sur l'écran d'accueil ».

## Développer

Aucune dépendance. `npm run dev` sert la page sur http://localhost:8000, `npm test` vérifie la logique de la pendule (`clock.js`). Quand les fichiers changent, augmenter `VERSION` dans `sw.js` pour que les téléphones prennent la nouvelle version.

## Crédits

Sons de coups : « Punch sound » de storegraphic sur Pixabay (licence Pixabay, utilisation libre).
