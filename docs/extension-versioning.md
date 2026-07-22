# Extension and API Versioning

## Sources of truth

- `ascendia-extension/manifest.json` is the authoritative source version for the Chrome extension.
- `CHROME_WEB_STORE_PUBLISHED_VERSION` records the version actually published to Chrome Web Store item `pneenlhefkghefjpaafgllkjkpfjnkgg`.
- `MINIMUM_SUPPORTED_EXTENSION_VERSION` records the oldest extension the backend accepts.
- `CURRENT_EXTENSION_API_VERSION` and `SUPPORTED_EXTENSION_API_VERSIONS` in `lib/extension-contract.ts` define the backend contract.
- `VERCEL_GIT_COMMIT_SHA` identifies the exact backend deployment.

Repository/source and Store-published extension versions may differ while a Store update is under review. Do not update `CHROME_WEB_STORE_PUBLISHED_VERSION` until the package is published.

## Request contract

Extension releases starting with `1.0.3` send:

```http
X-Aletheia-API-Version: 1
X-Aletheia-Extension-Version: 1.0.3
```

The published `1.0.2` client sends neither header. Missing headers are treated as legacy extension `1.0.2` using API v1 so the versioning rollout is backward compatible.

Compatibility is enforced on generation and feedback. Config, version, and session remain reachable so an outdated client can authenticate and discover update information.

## Manifest bump policy

Increase `manifest.json` whenever a file shipped in the extension ZIP changes, including background scripts, content scripts, popup/settings files, icons, assets, the manifest, or the ZIP builder. Keep `ascendia-extension/package.json` synchronized with the manifest.

Backend-only changes do not require a manifest bump when the existing request and response contract remains compatible.

Run the guard locally against the target branch:

```bash
npm run check:extension-version -- origin/main
```

CI runs the same guard against the pull request base SHA.

## Safe breaking-change rollout

1. Deploy a backend that supports both the existing and new contracts.
2. Keep the current Store version at or above `MINIMUM_SUPPORTED_EXTENSION_VERSION`.
3. Publish the new extension to the existing Store item.
4. Monitor request logs by `extensionVersion`, `apiVersion`, and `legacyExtensionClient`.
5. Raise the minimum supported version only after the new Store release is available and adoption is sufficient.
6. Remove the legacy contract in a later backend release.

Never deploy a backend that requires an extension version still awaiting Chrome Web Store review.

## Store artifact

`npm run build:extension` writes:

- `ascendia-extension/dist/aletheia-extension.zip`
- `ascendia-extension/dist/aletheia-extension.version.json`

The metadata includes extension version, API version, Git SHA, build time, ZIP size, SHA-256 checksum, and Store item ID when `CHROME_WEB_STORE_ITEM_ID` is configured.
