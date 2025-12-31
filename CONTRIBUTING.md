# Contributing to NEXUS Guardian

Merci de votre intérêt pour contribuer à NEXUS Guardian ! 🎉

Ce document fournit des guidelines pour contribuer au projet. En suivant ces règles, vous nous aidez à maintenir un projet de qualité.

## 📋 Table des Matières

- [Code of Conduct](#code-of-conduct)
- [Comment Contribuer](#comment-contribuer)
- [Standards de Code](#standards-de-code)
- [Process de Pull Request](#process-de-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

En participant à ce projet, vous acceptez de respecter notre [Code of Conduct](CODE_OF_CONDUCT.md). Soyez respectueux, inclusif et professionnel.

---

## Comment Contribuer

### 🐛 Corriger un Bug

1. Vérifiez qu'une issue n'existe pas déjà
2. Si non, créez une issue décrivant le bug
3. Attendez la validation avant de commencer à coder
4. Créez une branche `fix/nom-du-bug`
5. Corrigez le bug avec tests si applicable
6. Soumettez une Pull Request

### ✨ Ajouter une Feature

1. Ouvrez une issue de type "Feature Request"
2. Discutez de la feature avec les mainteneurs
3. Une fois approuvée, créez une branche `feature/nom-feature`
4. Implémentez la feature
5. Ajoutez des tests et documentation
6. Soumettez une Pull Request

### 📝 Améliorer la Documentation

La documentation est toujours perfectible ! Les contributions incluent :

- Corriger des typos
- Améliorer la clarté
- Ajouter des exemples
- Traduire dans d'autres langues

---

## Standards de Code

### Style JavaScript

**NEXUS Guardian** utilise du JavaScript Vanilla ES6+. Suivez ces conventions :

```javascript
// ✅ BON
async function fetchUserData(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

// ❌ MAUVAIS
function fetchUserData(userId) {
    return fetch('/api/users/' + userId).then(function(response) {
        return response.json();
    });
}
```

### Naming Conventions

- **Variables**: `camelCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Fonctions**: `camelCase` (verbe + nom)
- **Classes**: `PascalCase`
- **Fichiers**: `kebab-case.js`

```javascript
// Variables
const userProfile = {};
const MAX_RETRIES = 3;

// Fonctions
function getUserById(id) {}
async function fetchRepoData() {}

// Classes
class AIEngine {}
```

### Commentaires

Commentez le **POURQUOI**, pas le **QUOI** :

```javascript
// ✅ BON
// Using Web Worker to avoid blocking UI during heavy computation
const worker = new Worker('./analysis.worker.js');

// ❌ MAUVAIS
// Create a new worker
const worker = new Worker('./analysis.worker.js');
```

### Structure des Fichiers

Organisez votre code logiquement :

```javascript
// 1. Imports (si modules)
// 2. Constantes
// 3. Fonctions utilitaires privées
// 4. Fonctions publiques / API
// 5. Event listeners / Init
```

---

## Process de Pull Request

### Avant de Soumettre

- [ ] Le code suit les standards du projet
- [ ] Tous les tests passent
- [ ] La documentation est à jour
- [ ] Les commits sont clairs et descriptifs
- [ ] Pas de code commenté inutile
- [ ] Pas de `console.log` de debug

### Format du Commit

Utilisez le format **Conventional Commits** :

```
type(scope): description

[body optionnel]

[footer optionnel]
```

**Types acceptés:**
- `feat`: Nouvelle feature
- `fix`: Bug fix
- `docs`: Documentation uniquement
- `style`: Formatting, pas de changement de code
- `refactor`: Refactoring sans changement de comportement
- `perf`: Amélioration de performance
- `test`: Ajout ou correction de tests
- `chore`: Maintenance (build, deps, etc.)

**Exemples:**
```bash
feat(audit): add cyclomatic complexity analysis
fix(crypto): correct AES-GCM initialization vector size
docs(readme): add installation instructions for Windows
refactor(github-api): extract common headers to constant
```

### Template de Pull Request

```markdown
## Description
Brève description des changements

## Type de Changement
- [ ] Bug fix
- [ ] Nouvelle feature
- [ ] Breaking change
- [ ] Documentation

## Checklist
- [ ] Code testé localement
- [ ] Documentation mise à jour
- [ ] Commits respectent les conventions
- [ ] Pas de breaking changes (ou documentés)

## Screenshots (si applicable)
[Ajouter screenshots ici]

## Tests Effectués
Décrire les tests manuels/automatiques
```

### Review Process

1. **Auto-checks**: Les tests automatiques doivent passer
2. **Code review**: Au moins 1 approbation d'un mainteneur
3. **Tests manuels**: Si applicable
4. **Merge**: Squash and merge pour garder l'historique propre

---

## Reporting Bugs

### Template d'Issue Bug

```markdown
**Describe the bug**
Description claire du bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
Ce qui devrait se passer

**Screenshots**
Si applicable

**Environment:**
 - OS: [e.g. Windows 10]
 - Browser: [e.g. Chrome 120]
 - Version: [e.g. 1.0.0]

**Additional context**
Tout contexte additionnel
```

### Informations Utiles

Pour aider au debugging, incluez :

- **Logs du navigateur** (Console)
- **Logs NEXUS** (depuis la page Logs)
- **Configuration** (providers, settings)
- **Steps précis** pour reproduire

---

## Suggesting Features

### Template d'Issue Feature

```markdown
**Is your feature request related to a problem?**
Description du problème

**Describe the solution you'd like**
Solution proposée

**Describe alternatives you've considered**
Alternatives envisagées

**Additional context**
Screenshots, mockups, etc.

**Priority**
Low / Medium / High / Critical
```

### Guidelines pour Features

**Bonne feature request:**
- ✅ Résout un problème réel
- ✅ Alignée avec la vision du projet
- ✅ Faisable techniquement
- ✅ Bénéfice clair pour les users
- ✅ Pas de duplication de feature existante

**Feature à éviter:**
- ❌ Trop spécifique à un use case unique
- ❌ Complexité excessive pour peu de valeur
- ❌ Dépendance à des services tiers instables
- ❌ Breaking changes sans raison majeure

---

## Development Setup

### Quick Start

1. **Clone le repo**
```bash
git clone https://github.com/yourusername/nexus-guardian.git
cd nexus-guardian
```

2. **Ouvrir avec un serveur local**
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

3. **Ouvrir le navigateur**
```
http://localhost:8000
```

### Testing Local Changes

**Avant de commit:**
```bash
# 1. Tester toutes les pages
# 2. Vérifier la console (pas d'erreurs)
# 3. Tester sur mobile (DevTools responsive mode)
# 4. Vérifier les logs NEXUS
```

**Checklist fonctionnelle:**
- [ ] Login / Master Password
- [ ] Configuration providers
- [ ] Mode Audit
- [ ] Mode Vibe
- [ ] Mode Contributor
- [ ] Mode Growth
- [ ] Liste Repos
- [ ] Logs système

---

## Questions ?

Si vous avez des questions, n'hésitez pas à :

- 💬 Ouvrir une [Discussion](https://github.com/yourusername/nexus-guardian/discussions)
- 📧 Contacter par email : nexusstudio100@gmail.com
- 🐛 Créer une [Issue](https://github.com/yourusername/nexus-guardian/issues)

---

## Merci !

Chaque contribution, aussi petite soit-elle, est précieuse. Merci de rendre NEXUS Guardian meilleur ! 🙏

---

<div align="center">

**Fait avec ❤️ par la communauté NEXUS**

</div>