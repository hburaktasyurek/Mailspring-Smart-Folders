# Mailspring Smart Folders

A general-purpose Mailspring plugin for named virtual folders that combine exact source folders or labels from one or more accounts. Smart Folders are read-only views: the plugin does not move, copy, delete, relabel, send, or otherwise mutate mail.

## Features

- Multiple named Smart Folders in a dedicated sidebar section.
- Account-grouped, hierarchical source picker.
- Any number of exact source folders or labels from one or more accounts.
- Native Mailspring thread list and message reader.
- Same-account overlap deduplication while preserving separate cross-account copies.
- Persistent create, edit, and delete workflows.
- Live native query subscriptions for synchronized data changes.
- Explicit warnings for unavailable sources; remaining valid sources continue to work.
- No external services, telemetry, runtime dependencies, or secondary mail database.

## Compatibility

Verified with:

- Mailspring `1.23.0-5b371811`
- macOS `26.6.2`

`package.json` declares Mailspring `>=1.23.0`. Other Mailspring releases and operating systems were not exercised in this verification run.

## Install

The release archive is self-contained; no build or `npm install` step is required.

1. Quit Mailspring.
2. Extract `mailspring-smart-folders-0.1.0.zip`.
3. In Mailspring, use **Developer > Install a Plugin...** and select the extracted `smart-folders` directory. If that menu is unavailable on macOS, copy or symlink the directory to:

   ```text
   ~/Library/Application Support/Mailspring/packages/smart-folders
   ```

4. Relaunch Mailspring.
5. Confirm that **Smart Folders** appears in the main sidebar.

Only install plugin archives from sources you trust. Mailspring plugins execute inside the application and can access local mail data.

## Use

1. Select **Add** in the **Smart Folders** sidebar section.
2. Enter a name.
3. Select one or more source folders or labels. Sources are grouped by account; nested rows are presentation only, and every checkbox selects exactly that folder.
4. Select **Save**.
5. Select the Smart Folder row to load its union in Mailspring's normal thread list.
6. Use **Edit** to rename or change sources. Use **Delete** to remove only the virtual definition; mail is never deleted.

A missing folder or removed account is shown with an unavailable-source warning. Available sources continue to populate the Smart Folder. If no source remains available, the list shows an explanatory empty state. Editing the definition lets you remove unavailable sources.

## Update

1. Quit Mailspring.
2. Replace the installed `smart-folders` directory with the newer release while keeping the package name `smart-folders`.
3. Relaunch Mailspring.

Definitions are stored in Mailspring configuration under `smart-folders.definitions` and remain available across an in-place update.

## Remove

1. If you also want to discard saved definitions, delete them from the Smart Folders UI first.
2. Quit Mailspring.
3. Remove the installed `smart-folders` directory or symlink from Mailspring's `packages` directory.
4. Relaunch Mailspring.

Removing the package does not mutate mail. Definitions left in Mailspring configuration are inert and reappear if the same package is installed again.

## Development verification

```sh
npm test
```

The test suite uses Node's built-in test runner and has no external dependencies. Detailed application and criterion evidence is in [VERIFICATION.md](VERIFICATION.md); the bounded product contract is in [SPEC.md](SPEC.md).

## Deliberate limitations

- Rules are source-folder membership only. Sender, subject, date, advanced Boolean rules, and automatic classification are out of scope.
- Smart Folders are local virtual views, not server-side folders or labels.
- The sidebar does not show an aggregate count. Summing per-folder counts would double-count overlapping sources; the native list remains thread-based.
- Saved definitions persist, but the currently focused Smart Folder is not restored as the initial view after an application restart.
- A deterministic live external sync event was not generated during verification because the test plan forbids sending, moving, or deleting real mail. The plugin uses Mailspring's native `MutableQuerySubscription`; see `VERIFICATION.md`.

## License and source review

This plugin is licensed under GNU GPL v3; see [LICENSE.md](LICENSE.md).

Implementation was written independently against Mailspring's public plugin APIs and inspected source:

- [Foundry376/Mailspring](https://github.com/Foundry376/Mailspring), GPL-3.0.
- [Foundry376/Mailspring-Plugin-Starter](https://github.com/Foundry376/Mailspring-Plugin-Starter), package metadata declares MIT.
- [colinking/mailspring-inbox-filters](https://github.com/colinking/mailspring-inbox-filters), package metadata declares MIT, but the inspected repository revision had no root license file. No source was copied from it.
