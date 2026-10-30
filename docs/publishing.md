# Publishing

The `Publish to npm` GitHub Actions workflow checks types, runs the TypeScript and Python tests, and packs the release. It uploads the exact tarball as a workflow artifact and publishes that tarball with provenance when publishing is enabled.

## First release

The current package is `@like/pi-obsidian`. The npm account must have permission to publish under `@like`. If using a different scope, update `package.json`, regenerate `package-lock.json` with `npm install --package-lock-only`, and update the README install command before releasing.

For the first release, create an npm granular access token with the required write permission and permission to publish in CI (including bypassing 2FA where required by the account policy). Add it as the repository Actions secret `NPM_TOKEN`. Enter the token at the prompt rather than including it in a shell command:

```bash
gh secret set NPM_TOKEN --repo ekil1100/pi-obsidian
```

Run validation without publishing:

```bash
gh workflow run publish.yml --ref main -f dry_run=true
```

After confirming the package name and configuring authentication, publish the version on `main`:

```bash
gh workflow run publish.yml --ref main -f dry_run=false
```

A successful dry run validates the package and workflow, not npm write access. Each npm version can be published only once.

## Trusted publishing

After the package exists, configure a trusted publisher in its npm settings:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `ekil1100` |
| Repository | `pi-obsidian` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty |
| Allowed actions | Allow direct `npm publish` |

The workflow uses GitHub-hosted runners, Node 24, and `id-token: write`. npm uses OIDC when the package trusts this workflow. Remove the `NPM_TOKEN` repository secret after trusted publishing is configured and revoke the token when it is no longer needed. New trusted publisher configurations must complete their first publish within npm's documented validity period; configure this immediately before the next release.

See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for current requirements.

## Subsequent versions

Update the package version and lockfile, commit the change, and push a matching version tag. For example:

```bash
npm version patch
git push origin main --follow-tags
```

Pushing `v*` tags runs the workflow and publishes automatically. The tag must exactly match `v` followed by the stable version in `package.json`. Prerelease versions are not supported by this initial workflow. Concurrent releases are serialized.
