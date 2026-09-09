# Mailspring Smart Folders

[![CI](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/actions/workflows/test.yml/badge.svg)](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/actions/workflows/test.yml)
[![Latest release](https://img.shields.io/github/v/release/hburaktasyurek/Mailspring-Smart-Folders)](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/releases/latest)
[![License: GPL-3.0-only](https://img.shields.io/badge/License-GPL--3.0--only-blue.svg)](LICENSE.md)

**Mailspring Smart Folders** is an open-source [Mailspring](https://www.getmailspring.com/) plugin for email productivity: create named, read-only virtual folders that combine exact IMAP folders or labels across one or more accounts. It uses Mailspring's normal thread list and reader, so a Smart Folder is a view of existing mail—not a server-side folder or a copy of messages.

> **Read-only by design.** The plugin does not move, copy, delete, relabel, send, or otherwise mutate mail. It adds no services, telemetry, or secondary mail database, and works offline against Mailspring's synchronized mail.

![Smart Folders in the Mailspring sidebar](assets/smart-folders-sidebar.png)

## Quick start

- **Install:** download and extract the latest [mailspring-smart-folders.zip](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/releases/latest/download/mailspring-smart-folders.zip) release asset, then choose **Developer > Install a Plugin...** in Mailspring and select the extracted `smart-folders` directory.
- **Create a view:** select **+** in the **Smart Folders** sidebar heading, name the view, select its source folders or labels, and select **Save**.
- **Use it:** select the Smart Folder to load the union of its sources in Mailspring's normal thread list.
- **Verified compatibility:** Mailspring `1.23.0-5b371811` on macOS `26.6.2`. Windows and Linux have not been tested.
- **Need help or want to contribute?** Open a [GitHub Issue](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/issues) or read [CONTRIBUTING.md](CONTRIBUTING.md).

## Features

- Multiple named Smart Folders in a native section directly below **All Accounts**, inside the same scrolling sidebar.
- Account-grouped, hierarchical source picker.
- Any number of exact source folders or labels from one or more accounts.
- Native Mailspring thread list and message reader.
- Same-account overlap deduplication while preserving separate cross-account copies.
- Persistent create, edit, and delete workflows.
- Live native query subscriptions for synchronized data changes.
- Explicit warnings for unavailable sources; remaining valid sources continue to work.
- Native menus use Mailspring's bundled `@electron/remote` on tested Mailspring `1.23.0`.

## Install

The installation archive attached to each [GitHub Release](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/releases/latest) is self-contained; no build or `npm install` step is required.

1. Download and extract the latest [mailspring-smart-folders.zip](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/releases/latest/download/mailspring-smart-folders.zip).
2. Keep Mailspring running. In Mailspring, choose **Developer > Install a Plugin...**.
3. Select the extracted `smart-folders` directory.
4. Confirm that **Smart Folders** appears in the main sidebar. Restart Mailspring only if it does not appear.

### Manual package installation fallback

Use this fallback only when **Developer > Install a Plugin...** is unavailable:

1. Quit Mailspring.
2. Copy the extracted `smart-folders` directory to the applicable package path:

   | Platform | Package path |
   | --- | --- |
   | macOS | `~/Library/Application Support/Mailspring/packages/smart-folders` |
   | Windows | `%APPDATA%\Mailspring\packages\smart-folders` |
   | Linux | `~/.config/Mailspring/packages/smart-folders` |

3. Relaunch Mailspring and confirm that **Smart Folders** appears in the main sidebar.

Only install plugin archives from sources you trust. Mailspring plugins execute inside the application and can access local mail data.

## First use

1. Select the **+** button in the **Smart Folders** sidebar heading.
2. Enter a name.
3. Select one or more source folders or labels. Sources are grouped by account; nested rows are presentation only, and every checkbox selects exactly that folder.
4. Select **Save**.
5. Select the Smart Folder row to load its union in Mailspring's normal thread list.
6. Right-click a row or open its **•••** button to display the native Mailspring/macOS context menu, matching ordinary folder rows, for editing or deleting it. Deleting removes only the virtual definition; mail is never deleted.

A missing folder or removed account is shown with an unavailable-source warning. Available sources continue to populate the Smart Folder. If no source remains available, the list shows an explanatory empty state. Editing the definition lets you remove unavailable sources.

## Compatibility

`package.json` declares Mailspring `>=1.23.0`. Verified with:

- Mailspring `1.23.0-5b371811`
- macOS `26.6.2`

Other Mailspring releases and operating systems were not exercised in this verification run.

## Update

Install a newer plugin archive through the in-app flow above. If you use the manual fallback, quit Mailspring, replace the `smart-folders` directory at the applicable package path, then relaunch Mailspring.

Definitions are stored in Mailspring configuration under `smart-folders.definitions` and remain available across an in-place update.

## Remove

1. If you also want to discard saved definitions, delete them from the Smart Folders UI first.
2. Quit Mailspring.
3. Remove the installed `smart-folders` directory from the applicable package path:

   | Platform | Package path |
   | --- | --- |
   | macOS | `~/Library/Application Support/Mailspring/packages/smart-folders` |
   | Windows | `%APPDATA%\Mailspring\packages\smart-folders` |
   | Linux | `~/.config/Mailspring/packages/smart-folders` |

4. Relaunch Mailspring.

Removing the package does not mutate mail. Definitions left in Mailspring configuration are inert and reappear if the same package is installed again.

## Support and contributions

For questions, bugs, and feature requests, use [GitHub Issues](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/issues). For project-specific setup, verification, privacy, and pull-request guidance, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Development verification

Run the behavior suite:

```sh
npm test
```

Build the same deterministic archive published by the release workflow:

```sh
npm run build:release
```

The test suite uses Node's built-in test runner and has no external dependencies. Detailed application and criterion evidence is in [VERIFICATION.md](VERIFICATION.md); the bounded product contract is in [SPEC.md](SPEC.md).

## Deliberate limitations

- Rules are source-folder membership only. Sender, subject, date, advanced Boolean rules, and automatic classification are out of scope.
- Smart Folders are local virtual views, not server-side folders or labels.
- The sidebar does not show an aggregate count. Summing per-folder counts would double-count overlapping sources; the native list remains thread-based.
- Saved definitions persist, but the currently focused Smart Folder is not restored as the initial view after an application restart.
- A deterministic live external sync event was not generated during verification because the test plan forbids sending, moving, or deleting real mail. The plugin uses Mailspring's native `MutableQuerySubscription`; see `VERIFICATION.md`.

## License and source attribution

This plugin is licensed under GNU GPL v3 only; see [LICENSE.md](LICENSE.md).

Implementation was written independently against Mailspring's public plugin APIs:

- [Foundry376/Mailspring](https://github.com/Foundry376/Mailspring), GPL-3.0.
- [Foundry376/Mailspring-Plugin-Starter](https://github.com/Foundry376/Mailspring-Plugin-Starter), package metadata declares MIT.
