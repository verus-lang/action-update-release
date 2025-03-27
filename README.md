# action-update-release

GitHub action to update an existing pre-release.

Based on https://github.com/viperproject/create-nightly-release

## Usage
```
- name: Update release
  id: update_release
  uses: verus-lang/action-update-release@v0.0.6
  env:
    # This token is provided by Actions, you do not need to create your own token
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    id: <release id>
    new_name: Release ${{ env.TAG_NAME }}
    new_body: New body for the release
    new_tag: ${{ env.TAG_NAME }}
    delete_assets: true
```

## Create a new Release
1. Checkout this repository and pull remote changes `git pull`
2. Checkout or create a release branch (replace `v1` with the major version number): 
  - `git checkout releases/v1; git pull origin main` or 
  - `git checkout -b releases/v1`
3. Run `npm version <newversion>` to set the version number
4. Run `rm -rf dist; rm -rf node_modules; npm ci`
5. Run `npm run package`
6. Force add the dist folder: `git add -f dist`
7. Commit: `git commit -m "<commit message>`
8. Push release branch: `git push`
9. Create a GitHub release with a tag, e.g. `v1.0.0`
10. Move the major tag (e.g. `v1`) to the latest release:
```
git tag -fa v1 -m "Update v1 tag"
git push origin v1 --force
```

[More information](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)
