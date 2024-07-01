// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2011-2020 ETH Zurich.
// Copyright (c) 2024 Andrea Lattuada.

import * as core from '@actions/core';
import * as github from '@actions/github';

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
    const new_name = core.getInput('new_name', {required: false});
    const new_body = core.getInput('new_body', {required: false});
    const new_tag = core.getInput('new_tag', {required: true});
    const commitish = github.context.sha;
    const delete_assets = Boolean(core.getInput('delete_assets', {required: false})) || false;

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
        await octokit.rest.repos.deleteReleaseAsset({
          owner,
          repo,
          asset_id: asset.id
        });
      }
    }

    // Create a release
    // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
    const updateReleaseResponse = await octokit.rest.repos.updateRelease({
      owner,
      repo,
      release_id: id,
      tag_name: new_tag,
      name: new_name,
      body: new_body,
      target_commitish: commitish,
    });

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: {id: releaseId, html_url: htmlUrl, upload_url: uploadUrl}
    } = updateReleaseResponse;

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

run();
