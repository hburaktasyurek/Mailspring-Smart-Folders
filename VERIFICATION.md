# Verification Report

## Environment

- Mailspring: `1.23.0-5b371811` (installed `/Applications/Mailspring.app`)
- macOS: `26.6.2`
- Automated-test runtime: Node.js `v26.8.1`
- Plugin package: `smart-folders` `0.1.0`

The installed app, its shipped source, the local mail database, Mailspring-Sync source, and the official plugin starter were inspected. Product verification used the installed Mailspring UI. Local mail data was queried read-only; the Mailspring bundle and production database were not modified.

## Automated behavior suite

Command:

```sh
npm test
```

Result: **Passed**.

Covered behavior:

- exact hierarchical source selection and account/category identity;
- selected-source union and exclusion;
- same-account overlap deduplication;
- preservation of separate cross-account thread copies;
- configuration persistence, create, update, delete, validation, and lifecycle;
- remaining-valid and all-invalid source behavior;
- normal, single-role hidden, mixed normal/hidden, and multi-role hidden-source queries;
- idempotent hidden-message reveal across loading, focus changes, and deactivation;
- native mutable-query subscription options, disabled drag mutation, and lifecycle cleanup.

## Application observations

- The release archive was extracted to a fresh directory, installed through **Developer > Install a Plugin...**, launched in Mailspring, and produced a single `.smart-folders-sidebar` section with no prototype section.
- The redesigned section rendered directly below **All Accounts** inside the account sidebar's shared `ScrollRegion`; it matched native heading and row typography/colors, exposed an icon-only add action, and kept row actions hidden until hover or keyboard focus.
- The redesigned editor opened without premature validation errors, showed its account-grouped exact source picker, kept its action footer visible, and independently scrolled the source list.
- A trusted physical right-click on a Smart Folder row displayed the native macOS menu immediately beside the clicked row, matching ordinary Mailspring folder placement, with **Edit Smart Folder…** and **Delete Smart Folder**. Placement relies on Electron's native cursor handling; the plugin supplies no pointer screen-coordinate arithmetic. The live callbacks opened the editor; deleting a disposable active definition removed it and returned focus to Inbox.
- A Smart Folder rendered native thread rows; opening a row rendered Mailspring's native message list.
- In source-linked and extracted-package launches, a controlled Smart Folder comprising Spam and Trash sources resolved no common shared role; a native message remained visible rather than being filtered as hidden.
- A valid selected source plus a synthetic unavailable source displayed an unavailable-source warning while continuing to render available results.
- A controlled all-unavailable definition rendered the explicit unavailable-sources empty state.
- Restarting Mailspring preserved a saved definition.
- Deactivation while a Smart Folder and its editor were active closed the editor, removed the section, portal mount, and stylesheet, focused a native inbox perspective, and detached the configuration subscription and store listeners. Reactivation restored the section at the same inline position without activation errors.
- Selecting a normal account-sidebar item cleared Smart Folder selection and rendered the normal native list.

The controlled unavailable-source and Spam/Trash fixtures changed only the plugin's own configuration and were restored immediately. No test sent, moved, relabeled, or deleted mail. Opening messages was a normal user action and may have changed read state according to Mailspring's normal behavior.

## Success criteria

| # | Status | Evidence |
|---|---|---|
| 1 | **Passed** | Installed Mailspring `1.23.0-5b371811` activated the extracted release package and rendered the Smart Folders section immediately below All Accounts within the shared account-sidebar scroll region. |
| 2 | **Passed** | The real UI created, edited, and deleted named definitions with distinct source selections; automated CRUD tests also passed. |
| 3 | **Passed** | The real picker selected configured sources and the native list rendered the combined view; the behavioral query test proved exact selected-source inclusion and unselected-source exclusion. |
| 4 | **Passed** | Product state persists and resolves account ID plus category ID, not display names. The account-grouped real picker and same-name cross-account test both passed. |
| 5 | **Passed** | The implementation requested SQL `DISTINCT` for multiple same-account sources, the behavior test passed, and the native UI did not duplicate thread IDs for shared memberships. |
| 6 | **Not testable** | No deterministic external sync event occurred, and the safety constraints prohibit generating one by sending, moving, or deleting real mail. The plugin does use Mailspring's live `MutableQuerySubscription` with `emitResultSet` and `updateOnSeparateThread`; that contract passed automated coverage, but mock/native-API evidence is not claimed as an end-to-end sync event. |
| 7 | **Passed** | Real UI edit/delete worked and a saved definition survived a full application restart. |
| 8 | **Passed** | Real app configuration fixtures proved an unavailable-source warning with continued valid results, followed by the explicit all-invalid empty state. Automated missing/invalid-source tests passed. |
| 9 | **Passed** | Smart Folder threads opened in Mailspring's native message list. The extracted package rendered a selected Spam+Trash-only view instead of filtering it as hidden; the union and UI use thread units, and no misleading summed sidebar counter is shown. |
| 10 | **Passed** | Actual package deactivation closed an active editor, replaced the custom perspective with native inbox, removed the inline section, portal mount, and stylesheet, and disposed the store subscription/listeners; clean reactivation restored the section. |
| 11 | **Passed** | A normal account-sidebar folder remained selectable, cleared Smart Folder selection, and rendered the native list. |
| 12 | **Not testable** | No publishable synthetic large-volume fixture exists for this public report. Private runtime volume and derived performance measurements are excluded. |

Summary: **10 passed, 0 failed, 2 not testable**.

## Limitations and blockers

- End-to-end live sync remains **not testable** in this run because no safe deterministic external message/folder change was available. This is an unmet evidence prerequisite, not a known implementation failure.
- Criterion 12 is **not testable** publicly because no publishable synthetic large-volume fixture is available; private runtime volume and derived performance measurements are excluded.
- Windows, Linux, and Mailspring versions other than `1.23.0-5b371811` were not exercised.
- The currently focused Smart Folder is not restored as the initial perspective after restart; saved definitions are restored.
- No aggregate sidebar count is displayed because per-source sums are incorrect for overlapping sources.
