// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2011-2020 ETH Zurich.
// Copyright (c) 2024 Andrea Lattuada.

import * as core from '@actions/core';
import * as github from '@actions/github';
import {GitHub} from '@actions/github/lib/utils';

async function run(): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(`Environment variable 'GITHUB_TOKEN' is not set`);
    }

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const octokit = github.getOctokit(token);

    // Get owner and repo from context of payload that triggered the action
    const {owner: owner, repo: repo} = github.context.repo;

    const id = Number(core.getInput('id', {required: true}));
    const delete_tags_prefix: string | null = core.getInput(
      'delete_tags_prefix',
      {required: false}
    );
    const new_tag = core.getInput('new_tag', {required: true});
    const new_draft_status: boolean | null = Boolean(
      core.getInput('new_draft_status', {required: false})
    );

    if (new_draft_status) {
      await octokit.rest.repos.updateRelease({
        owner,
        repo,
        release_id: id,
        draft: new_draft_status
      });
    }

    if (delete_tags_prefix) {
      // see https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repository-tags
      const {data: tags} = await octokit.rest.repos.listTags({
        owner,
        repo
      });

      const tagsToBeDeleted = tags
        .filter((tag: Tag) => tag.name.startsWith(delete_tags_prefix))
        .filter((tag: Tag) => tag.name !== new_tag);

      for (const tag of tagsToBeDeleted) {
        await deleteTag(octokit, owner, repo, tag);
        core.info(`Release '${tag.name}' was successfully deleted`);
      }
      core.info(`${tagsToBeDeleted.length} release(s) have been deleted`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error);
    } else {
      core.setFailed(`unknown error type ${error}`);
    }
  }
}

async function deleteTag(
  octokit: InstanceType<typeof GitHub>,
  owner: string,
  repo: string,
  tag: Tag
): Promise<void> {
  // see https://octokit.github.io/rest.js/v18#git-delete-ref
  await octokit.rest.git.deleteRef({
    owner,
    repo,
    ref: `tags/${tag.name}`
  });
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
