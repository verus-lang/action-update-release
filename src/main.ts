// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2011-2020 ETH Zurich.
// Copyright (c) 2024 Andrea Lattuada.

import * as core from '@actions/core';
import * as github from '@actions/github';

// Function to turn empty string to null
function emptyStringToUndefined(s: string): string | undefined {
  if (s === '') {
    return undefined;
  } else {
    return s;
  }
}

async function run(): Promise<void> {
  // partially taken from https://github.com/actions/create-release
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(`Environment variable 'GITHUB_TOKEN' is not set`);
    }

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const octokit = github.getOctokit(token);

    // Get owner and repo from context of payload that triggered the action
    const {owner: owner, repo: repo} = github.context.repo;

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const id = Number(core.getInput('id', {required: true}));
    const new_name = emptyStringToUndefined(
      core.getInput('new_name', {required: false})
    );
    const new_body = emptyStringToUndefined(
      core.getInput('new_body', {required: false})
    );
    const new_tag = emptyStringToUndefined(
      core.getInput('new_tag', {required: false})
    );
    const commitish = github.context.sha;
    const delete_assets =
      Boolean(core.getInput('delete_assets', {required: false})) || false;
    const delete_tags_prefix: string | null = core.getInput(
      'delete_tags_prefix',
      {required: false}
    );
    const new_draft_status_str: string | undefined = emptyStringToUndefined(
      core.getInput('new_draft_status', {required: false})
    );
    let new_draft_status: boolean | undefined = undefined;
    if (new_draft_status_str !== undefined) {
      if (new_draft_status_str !== 'true' && new_draft_status_str !== 'false') {
        throw new Error(`new_draft_status must be either 'true' or 'false'`);
      }
      new_draft_status = new_draft_status_str === 'true';
    }

    core.info(
      `arguments: ${JSON.stringify({id, new_name, new_body, new_tag, commitish, delete_assets, delete_tags_prefix, new_draft_status})}`
    );

    if (delete_assets) {
      // Delete all assets from release
      // API Documentation: https://developer.github.com/v3/repos/releases/#delete-a-release-asset
      // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-delete-release-asset
      const assets = await octokit.rest.repos.listReleaseAssets({
        owner,
        repo,
        release_id: id
      });

      for (const asset of assets.data) {
        if (asset.name !== 'placeholder') {
          await octokit.rest.repos.deleteReleaseAsset({
            owner,
            repo,
            asset_id: asset.id
          });
        }
      }
    }

    if (delete_tags_prefix !== null) {
      // see https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repository-tags
      const {data: tags} = await octokit.rest.repos.listTags({
        owner,
        repo
      });

      const tagsToBeDeleted = tags
        .filter((tag: Tag) => tag.name.startsWith(delete_tags_prefix))
        .filter((tag: Tag) => tag.name !== new_tag);

      for (const tag of tagsToBeDeleted) {
        await octokit.rest.git.deleteRef({
          owner,
          repo,
          ref: `tags/${tag.name}`
        });
        core.info(`Tag '${tag.name}' was successfully deleted`);
      }
      core.info(`${tagsToBeDeleted.length} release(s) have been deleted`);
    }

    if (new_tag !== undefined) {
      core.info(`Creating tag '${new_tag}' from commit '${commitish}'`);
      // Create a new tag
      // API Documentation: https://developer.github.com/v3/git/tags/#create-a-tag-object
      // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-git-create-tag
      const newTag = await octokit.rest.git.createTag({
        owner,
        repo,
        tag: new_tag,
        message: `release ${new_tag}`,
        object: commitish,
        type: 'commit'
      });

      // Create a new reference
      // API Documentation: https://developer.github.com/v3/git/refs/#create-a-reference
      // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-git-create-ref
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/tags/${new_tag}`,
        sha: newTag.data.sha
      });
      core.info(`Tag '${new_tag}' was successfully created`);
    }

    let getUpdateReleaseResponse;
    if (
      new_tag !== undefined ||
      new_name !== undefined ||
      new_body !== undefined ||
      commitish !== undefined ||
      new_draft_status !== undefined
    ) {
      let updateReleaseParams: {
        owner: string;
        repo: string;
        release_id: number;
        target_commitish: string;
        tag_name: string | undefined;
        name: string | undefined;
        body: string | undefined;
        draft: boolean | undefined;
      } = {
        owner,
        repo,
        release_id: id,
        target_commitish: commitish,
        tag_name: undefined,
        name: undefined,
        body: undefined,
        draft: undefined
      };
      if (new_tag !== null) {
        updateReleaseParams = {...updateReleaseParams, tag_name: new_tag};
      }
      if (new_name !== null) {
        updateReleaseParams = {...updateReleaseParams, name: new_name};
      }
      if (new_body !== null) {
        updateReleaseParams = {...updateReleaseParams, body: new_body};
      }
      if (new_draft_status !== null) {
        updateReleaseParams = {...updateReleaseParams, draft: new_draft_status};
      }
      // API Documentation: https://developer.github.com/v3/repos/releases
      // Octokit Documentation: https://octokit.github.io/rest.js
      getUpdateReleaseResponse =
        await octokit.rest.repos.updateRelease(updateReleaseParams);
      core.info(
        `Release ${id} was successfully updated, with the following changes:\n` +
          `- tag_name: ${new_tag}\n - name: ${new_name}\n - body: ${new_body}\n - target_commitish: ${commitish}\n - draft: ${new_draft_status}`
      );
    } else {
      getUpdateReleaseResponse = await octokit.rest.repos.getRelease({
        owner,
        repo,
        release_id: id
      });
    }

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: {id: releaseId, html_url: htmlUrl, upload_url: uploadUrl}
    } = getUpdateReleaseResponse;

    // Set the output variables for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    core.setOutput('id', releaseId);
    core.setOutput('html_url', htmlUrl);
    core.setOutput('upload_url', uploadUrl);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`unknown error type ${error}`);
    }
  }
}

interface Tag {
  name: string;
  commit: Commit;
  zipball_url: string;
  tarball_url: string;
  node_id: string;
}

interface Commit {
  sha: string;
  url: string;
}

run();
