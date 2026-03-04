---
description: How to wrap up and release a completed feature
---

# Land a Feature

Use this workflow after a feature implementation is complete and verified (build passes, visually tested).

// turbo-all

## Steps

1. **Update README.md**
   - Add feature to the Features bullet list
   - Update the Project Structure section if new files were added
   - Mark the roadmap item as `[x]` complete
   - Update any relevant tables (e.g., The Rooms table for room changes)

2. **Update CONTRIBUTING.md**
   - Update Project Structure to reflect new/changed files
   - Remove completed items from "What to Work On" list
   - Add any new contribution ideas

3. **Update CHANGELOG.md**
   - Add a new version section at the top (above previous version)
   - Format: `## X.Y.Z (YYYY-MM-DD)`
   - List features under `### Features` with `*` bullets
   - Use `minor` bump for features, `patch` for fixes

4. **Bump version in package.json**
   - Update the `"version"` field to match the CHANGELOG

5. **Commit, tag, and push**
   ```bash
   git add -A
   git commit -m "feat: <short description of the feature>"
   git tag v<version>
   git push && git push --tags
   ```

## Version Numbering

- `patch` (0.x.Y) — bug fixes, small tweaks
- `minor` (0.X.0) — new features
- `major` (X.0.0) — breaking changes

## Conventional Commit Prefixes

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes nor adds
- `chore:` — build process, dependencies
- `ci:` — CI/CD changes
