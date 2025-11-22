# Commit Message Guidelines & Branch Guidelines

To keep our Git history clean and meaningful, follow these commit message conventions.

## Commit Format
### Allowed Commit Types
| Type       | Usage |
|------------|------------------------------------------------|
| `feat:`    | New feature added |
| `fix:`     | Bug fix or patch |
| `chore:`   | Maintenance, refactoring, or dependencies |
| `docs:`    | Documentation updates |
| `style:`   | Code formatting (no logic changes) |
| `refactor:`| Code restructuring (no behavior change) |
| `test:`    | Adding or modifying tests |
| `ci:`      | CI/CD pipeline updates |
| `revert:`  | Revert previous commits |

---

## Creating Branches
Please create your branches name in this format ```Commit-Format/name/<what you're working on goes here>```
- Note, when building a ```feat```, write the full name like ```feature/Bob/Creating-HomePage-Button```

## ✅ Examples
✅ **Good commits:**
- feat: add login page UI
- fix: resolve API timeout issue on dashboard
- chore: update dependencies to latest version
- docs: add README section for environment setup
- test: add unit tests for auth middleware

**Tip:** Use `git commit -m "feat: add user authentication"` instead of vague commit messages.

---

## Branching & Workflow
  1. Work in a separate branch 
  2. Merge to main

---
