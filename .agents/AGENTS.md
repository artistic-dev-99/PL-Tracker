# Project Rules & Feature Preservation Guidelines for AI Agents

## Critical Rule: Feature Preservation & Non-Destructive Edits
1. **Never Delete Existing Features**: Do NOT remove, rename, or overwrite existing UI tabs, components, API endpoints, backend services, or CSS styles unless explicitly instructed by the user.
2. **Inspect Before Mutating**: Before modifying any file, search for existing dependencies and related functions using `grep_search` and `view_file`. Verify where the function/component is used across client and server files.
3. **Preserve Backward Compatibility**: When adding new functionality, extend existing schemas/signatures with optional parameters or add new endpoints/modules rather than replacing existing ones.

## Mandatory Workflow for AI Execution
1. **Pre-flight Check**: Check `README.md` and `FEATURES.md` to understand all active components and API endpoints.
2. **Git Safety Check**: Verify git status and check diffs before committing new changes.
3. **Automated Verification**: After making changes to server logic, run unit tests to verify no existing tests are broken:
   ```bash
   python -m unittest discover -s tests
   ```
4. **Documentation Sync**: Update `FEATURES.md` whenever a new route, service, component, or tab is added to ensure future AI sessions maintain complete awareness.
