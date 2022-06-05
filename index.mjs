#!/usr/bin/env node
/**
 * Copyright (c) Moodle Pty Ltd.
 *
 * Moodle is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Moodle is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Moodle.  If not, see <http://www.gnu.org/licenses/>.
 */
import core from '@actions/core';
import github from '@actions/github';
import { NetlifyAPI } from 'netlify';

const client = new NetlifyAPI(core.getInput('netlify_secret'));

const getBuildId = async (prNumber) => {
  const builds = await client.listSiteBuilds({
    site_id: core.getInput('site_id'),
  });
  console.log(core.getInput('site_id'));
  console.log(builds);
  const build = builds.find((data) => (data.sha === `pull/${prNumber}/head`));
  if (!build) {
    return null;
  }

  return client.getDeploy({ deploy_id: build.deploy_id });
};

const pollUntilReady = async (prNumber, timeout = 300) => {
  const startTime = Date.now();

  do {
    const build = await getBuildId(prNumber);
    if (build) {
      console.debug(`Checking build ${build.id} (state: ${build?.state})`);
    } else {
      console.debug('No build data');
    }

    if (build?.state === 'ready') {
      return build;
    }
  } while (((Date.now() - startTime) / 1000) < timeout);

  return null;
};

const run = async () => {
  const PR_NUMBER = github.context.payload.number;
  if (!PR_NUMBER) {
    core.setFailed(
      "Action must be run in conjunction with the `pull_request` event"
    );
  }

  console.log(`Looking for Pull Request ${PR_NUMBER}`);

  const MAX_TIMEOUT = Number(core.getInput("max_timeout")) || 60;

  const deploy = await pollUntilReady(PR_NUMBER, MAX_TIMEOUT);
  if (!deploy) {
      core.setFailed(`Unable to find a build for ${PR_NUMBER}`);
  }

  if (deploy.state === 'ready') {
    console.log(`Build was successful and is available at ${deploy.links.permalink}`);
    core.setOutput('deployUrl', deploy.links.permalink);
  }

  core.setFailed('Unable to find a successful build');
};

run();
