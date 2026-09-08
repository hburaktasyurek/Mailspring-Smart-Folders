# Smart Folders Specification

## Product goal

Provide a general-purpose Mailspring plugin that lets users define multiple virtual folders. Each smart folder combines explicitly selected source folders from one or more accounts without moving, copying, deleting, relabeling, or otherwise modifying mail.

## In scope

- A **Smart Folders** sidebar section with create, rename/edit, and delete workflows.
- A hierarchical account/folder source picker supporting multiple sources across accounts.
- Stable source references by account ID and folder ID; display names are presentation only.
- Exact-folder membership: selecting a folder does not implicitly select descendants.
- A union rendered through Mailspring's normal thread/message list and reading flow.
- Deduplication of the same item reached through overlapping folders within one account; no automatic deduplication across accounts.
- Live reflection of source changes after Mailspring synchronization.
- Persisted definitions across application restarts.
- Explicit missing-source presentation while valid sources continue to work; an explanatory empty state when none remain valid.
- Symmetric plugin activation/deactivation with all registered UI and listeners removed.
- Automated behavioral coverage for source selection, union/exclusion, deduplication, persistence/CRUD, and missing sources.
- An installable package; installation, usage, update, and removal instructions; tested-version, criterion, limitation, blocker, and performance evidence.

## Out of scope

- Sender, subject, date, advanced AND/OR, or other message-content rules.
- Automatic moving, classification, AI, telemetry, or external services.
- Account/authentication/synchronization infrastructure.
- A second mail database or server-side folders/labels.
- Any plugin-initiated mail mutation, including when deleting a smart folder.
- Mailspring core, installed application bundle, or production database modifications.
- Tests that send, delete, or move real mail.
- A shortcut that only fills the search field.
- Unrelated application fixes or refactoring.

Normal user actions retain Mailspring's existing effects, including marking a message read when opened. The plugin itself must not mutate mail.

## Success criteria

1. The plugin loads in the installed Mailspring version.
2. Users can create multiple named smart folders without editing code and assign different source sets.
3. A union of selected folders from at least two accounts is correct; unselected sources are excluded.
4. Same-named folders belonging to different accounts are not confused.
5. Overlapping selected sources in one account do not duplicate the same item.
6. Synchronized source changes appear without restarting Mailspring.
7. Definitions survive restart; edit and delete work correctly.
8. Missing sources and a wholly invalid source set have explicit, controlled behavior.
9. Messages/threads open normally; grouping and count units remain consistent.
10. Disabling the plugin removes its components and listeners.
11. Normal folder navigation, listing, and reading remain unaffected.
12. At the reported test volume there is no noticeable UI freeze or needless repeated full-data scan.

## Delivery evidence

For each criterion, report **passed**, **failed**, or **not testable**, with a short concrete observation. Build or mock-only checks do not prove application integration. If the real test environment cannot exercise an item, report the missing prerequisite rather than weakening the criterion.
