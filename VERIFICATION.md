# Verification Report

## Environment

- Mailspring: `1.23.0-5b371811` (installed `/Applications/Mailspring.app`)
- macOS: `26.6.2`
- Automated-test runtime: Node.js `v26.8.1`
- Local test volume: 14,897 threads, 32,787 thread/category memberships, 46 folders and labels, two configured accounts
- Plugin package: `smart-folders` `0.1.0`

The installed app, its shipped source, the local mail database, Mailspring-Sync source, the official plugin starter, and one similar plugin were inspected. Product verification used the installed Mailspring UI. Local mail data was queried read-only; the Mailspring bundle and production database were not modified.

## Automated behavior suite

Command:

```sh
npm test
```

Result: **15 passed, 0 failed, 0 skipped** in 45.314 ms.

Covered behavior:

- exact hierarchical source selection and account/category identity;
- selected-source union and exclusion;
- same-account overlap deduplication;
- preservation of separate cross-account thread copies;
- configuration persistence, create, update, delete, validation, and lifecycle;
- remaining-valid and all-invalid source behavior;
- normal, spam/trash, and mixed-visibility queries;
- native mutable-query subscription options and disabled drag mutation.
- active-editor and focused-perspective deactivation cleanup.

## Application observations

- Final package activation produced one `.smart-folders-sidebar` section and no prototype section.
- The final `dist/mailspring-smart-folders-0.1.0.zip` was extracted, installed through the package-directory link, launched in Mailspring, and rendered the persisted Smart Folder.
- The editor showed two account groups and 46 exact folder/label checkboxes.
- Two definitions were created with different source sets: one with 46 sources across two accounts and one with two sources across two accounts.
- Edit changed a definition's name and selected sources; delete removed only the definition.
- The 46-source Smart Folder rendered 14 native thread rows; opening a row rendered the native message list with one message item.
- A selected high-volume valid source plus one synthetic unavailable source showed `1 source unavailable` and continued to render 14 rows.
- A controlled all-unavailable definition rendered zero rows and `None of this Smart Folder’s sources are currently available.`
- Restarting Mailspring preserved the saved `Combined Mail` definition.
- Deactivation while both a Smart Folder and its editor were active closed the editor, removed the sidebar and stylesheet, focused a native inbox perspective, detached the configuration subscription, and left zero store listeners. Reactivation restored one section without activation errors.
- Selecting a normal account-sidebar item cleared Smart Folder selection and rendered the normal native list.
- At the recorded data volume, a 46-source Smart Folder produced its first visible row in 168 ms after an application restart. The plugin delegates to one indexed native query subscription and does not scan all models in JavaScript.

The controlled unavailable-source fixtures changed only the plugin's own configuration and were restored immediately. No test sent, moved, relabeled, or deleted mail. Opening one message was a normal user action and may have changed its read state according to Mailspring's normal behavior.

## Success criteria

| # | Status | Evidence |
|---|---|---|
| 1 | **Passed** | Installed Mailspring 1.23.0 activated the package and rendered one Smart Folders sidebar section. |
| 2 | **Passed** | The real UI created two named definitions with different two-account source sets; automated CRUD tests also passed. |
| 3 | **Passed** | The real picker selected sources from both accounts and the native list rendered the combined view; the behavioral query test proved exact selected-source inclusion and unselected-source exclusion. |
| 4 | **Passed** | Product state persists and resolves account ID plus category ID, not display names. The account-grouped real picker and same-name cross-account test both passed. |
| 5 | **Passed** | The local data contains overlapping memberships; the implementation requested SQL `DISTINCT` for multiple same-account sources, the behavior test passed, and all 14 visible native rows had unique thread IDs. |
| 6 | **Not testable** | No deterministic external sync event occurred, and the safety constraints prohibit generating one by sending, moving, or deleting real mail. The plugin does use Mailspring's live `MutableQuerySubscription` with `emitResultSet` and `updateOnSeparateThread`; that contract passed automated coverage, but mock/native-API evidence is not claimed as an end-to-end sync event. |
| 7 | **Passed** | Real UI edit/delete worked and the remaining definition survived a full application restart. |
| 8 | **Passed** | Real app configuration fixtures proved a warning plus continued valid results, then the explicit all-invalid empty state. Automated missing/invalid-source tests passed. |
| 9 | **Passed** | A Smart Folder thread opened in Mailspring's native message list. The union and UI use thread units; no misleading summed sidebar counter is shown. |
| 10 | **Passed** | Actual package deactivation closed an active editor, replaced the custom perspective with native inbox, removed the section and stylesheet, and disposed the store subscription/listeners; clean reactivation succeeded. |
| 11 | **Passed** | A normal account-sidebar folder remained selectable, cleared Smart Folder selection, and rendered the native list. |
| 12 | **Passed** | With 14,897 threads, 32,787 memberships, and all 46 sources selected, first visible row appeared in 168 ms with no observed UI freeze or JavaScript full-data scan. |

Summary: **11 passed, 0 failed, 1 not testable**.

## Limitations and blockers

- End-to-end live sync remains **not testable** in this run because no safe deterministic external message/folder change was available. This is the only unmet evidence prerequisite, not a known implementation failure.
- Windows, Linux, and Mailspring versions other than `1.23.0-5b371811` were not exercised.
- Performance evidence covers the recorded local volume and one 46-source view; it is not a guarantee for substantially larger databases or slower storage.
- The currently focused Smart Folder is not restored as the initial perspective after restart; saved definitions are restored.
- No aggregate sidebar count is displayed because per-source sums are incorrect for overlapping sources.
