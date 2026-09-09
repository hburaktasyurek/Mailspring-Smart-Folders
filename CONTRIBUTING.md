# Contributing to Mailspring Smart Folders

## Report bugs first

Open a [GitHub Issue](https://github.com/hburaktasyurek/Mailspring-Smart-Folders/issues) before preparing a bug-fix pull request. Describe the expected and observed behavior, reproduction steps, Mailspring version, operating system, plugin version, and whether the sources are folders or labels. Redact account names, email addresses, message content, and local paths.

## Set up and verify changes

1. Clone [hburaktasyurek/Mailspring-Smart-Folders](https://github.com/hburaktasyurek/Mailspring-Smart-Folders).
2. Run the project verification command:

   ```sh
   npm test
   ```

   The test suite uses Node's built-in test runner and has no external dependencies.
3. For a UI change, install the changed plugin directory in Mailspring using **Developer > Install a Plugin...** and manually exercise the affected sidebar, editor, and context-menu behavior. Use the tested configuration when available: Mailspring `1.23.0-5b371811` on macOS `26.6.2`.

## Protect mail and privacy

- Preserve the read-only invariant: the plugin must not move, copy, delete, relabel, send, or otherwise mutate mail.
- Use fabricated or privacy-safe fixtures for tests, bug reports, and screenshots. Do not include mail bodies, sender or recipient addresses, account names, or local mail data in the repository or an issue.
- Do not add services, telemetry, or a secondary mail database.

## Submit focused pull requests

Keep each pull request focused on one issue or narrowly described improvement. Include the linked issue, the behavior changed, the verification performed, and any manual Mailspring checks required by a UI change. Update user-facing guidance when the install, use, compatibility, limitation, or trust-boundary contract changes.
