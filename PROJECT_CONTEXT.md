# Contexte & Historique du Projet Potager

> Fichier de référence pour conserver la mémoire des décisions, fonctionnalités implémentées et préférences utilisateur entre les sessions de chat.

---

## 1. Architecture & Configuration clé
* **Stack** : React + Vite + TypeScript + Tailwind CSS, avec persistance Cloud Firestore (Firebase).
* **Projet Firebase** : `gen-lang-client-0410975419`
* **Base Firestore** : `ai-studio-5e99e311-d3dc-4085-9892-a0b63aed5f7a` (`firebase-applet-config.json`)
* **Accès partagé** : `fdeleflie@gmail.com` (propriétaire principal) et `kdeleflie@gmail.com` (lecture/écriture partagée via `public_shares/fdeleflie` et `firestore.rules`).
* **Priorisation Quota Firestore (`src/hooks/useFirebaseData.ts`)** :
  * Collections prioritaires (`PRIORITY_COLLECTIONS`) : `journal`, `perpetualTasks`, `seedlings`, `trees`, `tasks`, `config`.
  * Collections secondaires (`SECONDARY_COLLECTIONS`) : `encyclopedia`, `healthIssues`, `expenses`, `structures`, `backups`.

---

## 2. Historique récent des fonctionnalités & correctifs validés

### A. Cohérence des quantités & arbres sur le plan (Noyer / Verger)
* **Fichier** : `src/views/EncyclopediaView.tsx`
* **Problème résolu** : Le total des plants sur une espèce (ex. Noyer avec 2 variétés `Inconnu` et `Standard`) cumulait `Math.max(quantité, arbres_sur_le_plan)` par variété isolée et affichait 3 au lieu de 2, avec des badges contradictoires.
* **Comportement actuel** :
  * Calcul global harmonisé au niveau de l'espèce (somme des quantités des variétés réconciliée avec le nombre d'arbres placés sur le plan).
  * Affichage permanent du total des plants sous forme de badge à droite du nom de chaque plante dans la liste latérale (`EncyclopediaView.tsx`) ainsi que dans l'impression/export (`catalogExport.ts`, `PlantCatalogPrintModal.tsx`).
  * Alerte explicite de dépassement (`⚠️ X / Y sur le plan`) avec bouton d'ajustement en 1 clic (`[Ajuster à X]`).
  * Section « Arbres placés sur le plan » sous les variétés d'une fiche plante permettant de réassigner directement la variété d'un arbre implanté.

### B. Suppression de plantes sans reclassement forcé
* **Fichier** : `src/components/DeletePlantModal.tsx`
* **Problème résolu** : L'ancienne plante cible de reclassement (ex. « Abricotier ») restait mémorisée d'une ouverture à l'autre, et le reclassement était pré-sélectionné par défaut.
* **Comportement actuel** :
  * Réinitialisation propre de la cible à chaque ouverture de la modale.
  * Mode par défaut = suppression directe (arbres/semis associés ou fiche seule), le reclassement restant une option explicite.

### C. Impression & Export du Catalogue
* **Fichiers** : `src/components/PlantCatalogPrintModal.tsx`, `src/utils/catalogExport.ts`, `src/views/EncyclopediaView.tsx`
* **Comportement actuel** :
  * Récapitulatif par catégorie en haut du document (mode Tableau Synthétique et Fiches Livret) : quantité d'espèces, nombre total de variétés, et nombre de plants placés sur le plan.
  * Affichage du total des plants par espèce dans le tableau synthétique et les fiches livret.

### D. Planning Récolte & Stockage (Gantt 12 mois) + Variétés temporaires (« En projet »)
* **Fichiers** : `src/utils/harvestStorageData.ts`, `src/components/HarvestStoragePlanningModal.tsx`, `src/components/PlantCatalogPrintModal.tsx`, `src/views/EncyclopediaView.tsx`, `src/views/HarvestCalendar.tsx`, `src/utils/catalogExport.ts`
* **Fonctionnalités** :
  * Planning Gantt 12 mois bicolore : **Récolte** (rouge `#ef4444`) et **Conservation / Stockage** (bleu ciel `#a5f3fc`).
  * Vues **Par Période** (chronologique selon début de récolte) et **Par Variété** (alphabétique).
  * Périmètre Global vs Sélection actuelle (catégories, recherche, plante sélectionnée), plus impression/PDF paysage.
  * Priorité de résolution des périodes : 1) Personnalisations manuelles → 2) Base fruitière intégrée (`KNOWN_HARVEST_STORAGE_DATA`) / autofill internet → 3) Période globale de l'espèce.
  * Sauvegarde persistante des modifications manuelles dans Firestore (`config`, attributs `harvestMonths`, `storageMonths`, `harvestSource`, `isManualHarvest`).
  * **Ajout temporaire de variétés** : case à cocher `⏳ Ajout temporaire / En projet`, badge ambré dédié, filtre `Tous / Catalogue / En projet` dans le Gantt, et bouton `✨ Valider au catalogue` en 1 clic.
  * **Différenciation source manuelle vs internet/référence & édition rapide** : indicateurs visuels `harvestSource` (`manual` vs `auto` vs `reference`) et modale d'édition rapide des périodes (`editingPeriodsVariety`) directement depuis la fiche variété.

---

## 3. Points de vigilance / Pistes ouvertes
* **Quota Firestore & Cache (`src/hooks/useFirebaseData.ts`)** :
  * Le compteur local (`trackFirebaseRead`) comptabilise actuellement les lectures issues du cache IndexedDB (`snapshot.metadata.fromCache` non filtré), ce qui peut déclencher prématurément l'état `isQuotaExceeded` côté client.
  * Les collections prioritaires (`PRIORITY_COLLECTIONS`) ne respectent pas le mode économie / cache local lors des rechargements, et `setLocalCache` dans `localStorage` peut saturer la limite de 5 Mo à cause des photos base64 et backups.
  * *En attente de confirmation utilisateur avant modification si souhaité.*
