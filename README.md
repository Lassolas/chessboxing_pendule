# Pendule Chessboxing

Pendule d'échecs pour les combats de chessboxing, faite pour le club Paris Chessboxing. C'est une page web installable sur téléphone (PWA) qui marche hors ligne.

**En ligne :** https://lassolas.github.io/chessboxing_pendule/

## Fonctionnalités

- Formats 5, 7, 9 ou 11 rounds : 4:30, 6:00, 7:30 ou 9:00 par joueur.
- Chaque joueur touche sa moitié d'écran pour finir son coup ; gros bouton pause au milieu.
- Option auto-pause : fin du round d'échecs à 3 min, puis pause et round de boxe chronométrés. Sans l'option, le coach met en pause et relance lui-même.
- Limite par coup : alerte à 20 s, compte à rebours de 10 s à partir de 30 s, puis partie perdue (avec « Continuer quand même »). Le temps de réflexion repart à zéro après la boxe.
- Comptes : chaque compte à rebours et chaque coup illégal (carton jaune dans le coin de chaque moitié, côté centre) est un compte. 3 comptes dans un round ou 4 au total : match perdu.
- Chaque alerte a toujours un son et un changement de couleur.
- Écran toujours allumé, plein écran, clavier ou bouton Bluetooth (Espace = pause, Entrée = coup joué).
- Tous les réglages (durées, seuils, nombre de comptes) sont modifiables dans « Réglages avancés ».

## Installer

Ouvre le lien sur le téléphone. Android : bouton « Installer l'appli ». iPhone : Partager puis « Sur l'écran d'accueil ».

## Développer

Aucune dépendance. `npm run dev` sert la page sur http://localhost:8000, `npm test` vérifie la logique de la pendule (`clock.js`). Quand les fichiers changent, augmenter `VERSION` dans `sw.js` pour que les téléphones prennent la nouvelle version.
