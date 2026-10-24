# Portfolio — Cénuel CHAFFA

Portfolio d'un étudiant en Génie Mécanique et Productique (INSTI Lokossa, Bénin).
Site statique (HTML/CSS/JS, sans framework) relié à **Firebase** : tu publies tes
projets et leurs photos depuis une page d'administration, sans toucher au code.

## Contenu du dépôt

```
index.html            Le site public
admin.html            Ton espace privé : projets, parcours, compétences, profil, CV, messages
css/style.css         Styles du site (thème clair / sombre)
css/admin.css         Styles de l'administration
js/main.js            Animations, filtres, galerie photo, partage, formulaire de contact
js/admin.js           Logique de l'administration
js/i18n.js            Version anglaise : détection de la langue et traductions de l'interface
js/content.js         Textes par défaut (profil, parcours), catégories, glossaire FR → EN
js/cv.js              Fabrication du CV PDF (français et anglais)
js/vendor/            pdfmake (création du PDF) et qrcode-generator (QR code), licence MIT
js/image-utils.js     Compression des photos dans le navigateur
js/skills.js          Compétences : valeurs par défaut, icônes, rendu des cartes
js/firebase.js        Chargement du SDK Firebase
js/firebase-config.js ← LE SEUL FICHIER À REMPLIR
firestore.rules       Règles de sécurité de la base de données
firebase.json         Configuration pour la CLI Firebase (optionnelle)
sitemap.xml           Plan du site pour Google
assets/               Photos de profil (3 tailles), image de partage, icône
assets/fonts/         Polices du CV (Manrope, Fraunces — licence SIL OFL)
```

Tant que `js/firebase-config.js` est vide, le site fonctionne en **mode statique** :
il affiche les 4 projets d'exemple et le formulaire de contact ouvre la messagerie.

---

## Relier le site à Firebase (≈ 15 minutes, gratuit)

### 1. Créer le projet
1. Va sur <https://console.firebase.google.com/> avec ton compte Google
   **chaffacenuel679@gmail.com**.
2. **Créer un projet** → nom : `portfolio-cenuel` (par exemple).
3. Google Analytics : tu peux le **désactiver** (inutile ici).
4. Le projet reste sur l'offre **Spark (gratuite)**. Aucune carte bancaire n'est nécessaire.

### 2. Ajouter l'application Web
1. Sur la page d'accueil du projet, clique sur l'icône **Web `</>`**.
2. Surnom : `site`. Ne coche **pas** « Firebase Hosting » pour l'instant.
3. Firebase affiche un bloc `const firebaseConfig = { ... }`.
4. Copie les valeurs dans **`js/firebase-config.js`** :

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "portfolio-cenuel.firebaseapp.com",
  projectId: "portfolio-cenuel",
  storageBucket: "portfolio-cenuel.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

> Ces valeurs **ne sont pas des secrets** : elles sont visibles par n'importe quel visiteur,
> sur n'importe quel site Firebase. La sécurité vient des **règles Firestore** (étape 4).
> En revanche, ne publie **jamais** un fichier de « compte de service » (JSON avec `private_key`).

### 3. Activer la connexion Google
1. Menu **Authentication** → **Commencer**.
2. Onglet **Méthode de connexion** → **Google** → **Activer** → choisis ton email d'assistance → Enregistrer.
3. Onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** :
   - `chaffacenuel679-dev.github.io` (si le site est sur GitHub Pages)
   - ton nom de domaine si tu en achètes un plus tard.
   (`localhost` est déjà autorisé pour les tests.)

### 4. Créer la base Firestore
1. Menu **Firestore Database** → **Créer une base de données**.
2. Emplacement : `europe-west1 (Belgique)` — proche du Bénin. **Ce choix est définitif.**
3. Démarrer en **mode production**.
4. Onglet **Règles** : remplace tout le contenu par celui du fichier **`firestore.rules`**, puis **Publier**.

### 5. Mettre en ligne
Fais un commit/push de `js/firebase-config.js`. Si GitHub Pages est activé
(dépôt → Settings → Pages → branche `main`, dossier `/ (root)`), le site est disponible à :
`https://chaffacenuel679-dev.github.io/mon_site_html/`

### 6. Publier ton premier projet
1. Ouvre `https://chaffacenuel679-dev.github.io/mon_site_html/admin.html`.
2. **Se connecter avec Google** (avec ton compte administrateur).
3. **+ Nouveau projet** → titre, catégorie, description → glisse tes photos → **Enregistrer**.
4. Recharge le site : ton projet apparaît dans « Projets & réalisations ».

Astuce : le bouton **Importer les projets d'exemple** recrée les 4 projets actuels du site
dans Firebase pour que tu puisses leur ajouter des photos.

---

## Ce que fait l'administration
- **Projets** : créer, modifier, publier/dépublier, mettre « à la une », supprimer.
- **Photos** : jusqu'à 30 par projet, glisser-déposer, légendes, ordre, choix de la couverture.
  Chaque photo est **compressée automatiquement** dans ton navigateur (WebP, 2000 px max,
  < 900 Ko) : une photo de téléphone de 5 Mo passe en ~300 Ko sans perte visible.
- **Messages** : tout ce que les visiteurs envoient via le formulaire de contact.
- **Compétences** : ajoute, modifie, réordonne ou supprime les cartes de compétences ;
  chaque compétence a un niveau (Notions, Débutant, Intermédiaire, Avancé, Expert) ou un simple point.
- **Parcours** : formations et expériences (stages, jobs…) de la section « Parcours » et du CV.
- **Profil** : photo, année d'étude (à changer à chaque rentrée), badge de disponibilité,
  textes de présentation, coordonnées, langues parlées, centres d'intérêt.
- **CV & partage** : état du CV, aperçus FR/EN, QR code du portfolio (PNG ou SVG),
  statistiques de visites (GoatCounter) et alerte email à chaque message (EmailJS).

## Version anglaise
- Le bouton **EN / FR** en haut du site change la langue ; le choix est mémorisé.
  Un visiteur dont le navigateur est en anglais arrive directement sur la version anglaise.
- Lien direct vers la version anglaise : `…/mon_site_html/?lang=en`.
- Dans l'admin, chaque éditeur a une partie **« Version anglaise (facultatif) »**.
  Si tu la laisses vide : les termes courants (compétences, catégories) sont traduits
  automatiquement, et les textes longs s'affichent en français.

## Le CV téléchargeable : comment il est construit et mis à jour
1. Le CV n'est **pas un fichier que tu écris** : il est fabriqué à partir du contenu du site
   (Profil → résumé, coordonnées, langues, intérêts ; Parcours ; Compétences ; projets publiés,
   « à la une » d'abord).
2. Dès que tu **enregistres une modification** dans l'admin, le CV français **et** anglais est
   régénéré automatiquement (environ une seconde) et remplace l'ancien. Rien d'autre à faire.
3. Le bouton **« Mon CV »** du site télécharge la version dans la langue du visiteur.
4. Réglages dans **Profil** : nombre de projets sur le CV, photo sur le CV (oui/non).
5. **CV & partage → Aperçu FR / Aperçu EN** pour le relire ; **Régénérer maintenant** si besoin.
6. Le CV contient un QR code qui mène à ton portfolio.
7. **CV & partage → Personnaliser le contenu du CV** : décoche ce que tu ne veux pas voir sur le CV
   (une formation, une compétence, un projet…) sans le retirer du site, et ajoute des rubriques
   réservées au CV (Certifications, Références…). Tout ce que tu ajoutes plus tard au site
   apparaît quand même automatiquement sur le CV.

## Services gratuits facultatifs
- **Statistiques de visites** : crée un compte sur goatcounter.com (gratuit, sans cookies),
  puis colle ton code (ex. `cenuel`) dans **CV & partage**. Tes statistiques sont sur
  `https://cenuel.goatcounter.com`.
- **Alerte email à chaque message** : crée un compte sur emailjs.com, ajoute un service
  (ton Gmail) et un modèle d'email utilisant `{{from_name}}`, `{{from_email}}`, `{{subject}}`,
  `{{message}}`, puis colle la *Public Key*, le *Service ID* et le *Template ID* dans **CV & partage**.
  Ces identifiants sont publics par nature (comme la configuration Firebase).

## Choix techniques (et pourquoi)
- **Pourquoi les photos sont dans Firestore et pas dans Firebase Storage ?**
  Depuis fin 2024, Google exige l'offre payante **Blaze** (carte bancaire obligatoire)
  pour utiliser Cloud Storage dans un nouveau projet. Pour rester 100 % gratuit,
  les photos compressées sont stockées dans Firestore (1 document par photo, limite 1 Mo).
  L'offre gratuite donne 1 Go de stockage (≈ 2 000 à 3 000 photos) et 50 000 lectures/jour,
  largement suffisant pour un portfolio.
- **Sécurité** : seul ton compte Google (email vérifié) peut écrire. Les visiteurs ne
  peuvent lire que les projets **publiés** et peuvent seulement **envoyer** un message
  (pas lire ceux des autres). Les règles ont été testées automatiquement (25 scénarios).
- Si tu changes un jour de compte administrateur, modifie l'email **à deux endroits** :
  `firestore.rules` et `js/firebase-config.js`.
- **Légèreté sur mobile** : le site public utilise **Firestore Lite** (≈ 35 Ko au lieu de ≈ 175 Ko),
  charge les contenus Firebase juste après l'affichage du haut de page (des squelettes
  s'affichent pendant l'attente) et met en pause les animations qui ne sont pas à l'écran.
  La page d'administration utilise le SDK Firebase complet.
- **Couvertures de projet** : elles sont téléchargées par chaque visiteur, elles sont donc
  limitées à ≈ 50 Ko. Si l'admin affiche « couvertures pouvant être allégées », clique sur
  **Alléger maintenant** (les photos en grand ne changent pas).

## Partage et référencement Google
- **Aperçu du lien** (WhatsApp, LinkedIn, Facebook…) : image `assets/og-image.jpg` (1200×630).
  Pour vérifier l'aperçu : <https://www.linkedin.com/post-inspector/> ou
  <https://developers.facebook.com/tools/debug/> (ces outils servent aussi à rafraîchir
  un ancien aperçu resté en cache).
- **Apparaître sur Google** : crée une propriété sur <https://search.google.com/search-console>
  avec l'adresse du site (type « Préfixe d'URL »), vérifie-la, puis envoie le plan du site
  `https://chaffacenuel679-dev.github.io/mon_site_html/sitemap.xml` (menu *Sitemaps*).
  Le site contient déjà des données structurées (schema.org `Person`) pour que Google
  comprenne qui tu es.

## Conseils pour des photos vraiment professionnelles
- Lumière naturelle, pas de contre-jour ; évite le flash direct sur le métal.
- Fond neutre et dégagé (une feuille blanche ou un mur uni suffit pour une petite pièce).
- Photographie la pièce **avec ses dessins techniques** ou le modèle CAO à côté.
- Montre les étapes : esquisse → modèle 3D → mise en plan → usinage → pièce finie.
- Pour la photo de profil : de face, buste, fond uni, tenue d'atelier propre ou chemise.

## Tester en local
Les modules JavaScript ne fonctionnent pas en ouvrant `index.html` par double-clic
(`file://`). Lance un petit serveur dans le dossier du projet :

```bash
python -m http.server 8000
# puis ouvre http://localhost:8000
```

## Hébergement alternatif : Firebase Hosting (optionnel)
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # choisis ton projet
firebase deploy               # publie le site ET les règles Firestore
```
Le site sera alors aussi disponible sur `https://<ton-projet>.web.app`.
