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

const MAX_TIMEOUT = Number(core.getInput("max_timeout")) || 60;
const REDUCED_TIMEOUT = MAX_TIMEOUT / 2;
const PR_NUMBER = github.context.payload.number;

const client = new NetlifyAPI(core.getInput('netlify_secret'));
const startTime = Date.now();

if (!PR_NUMBER) {
  core.setFailed(
    "Action must be run in conjunction with the `pull_request` event"
  );
}

/**
 * Get the build information for the specified pull request.
 *
 * This is just the basic build information, and does not include the final state of the build.
 *
 * @return {object}
 */
const getBuildData = async () => {
  do {
    // Fetch the list of site builds.
    // Unfortunately the Netlify API does not provide a way to search for a specific build so all builds are fetched.
    const builds = await client.listSiteBuilds({
      site_id: core.getInput('site_id'),
    });

    // Look for the first build matching the PR Number.
    const build = builds.find((data) => (data.sha === `pull/${PR_NUMBER}/head`));
    if (build) {
        return build;
    }

    // Sleep for 5 seconds to reduce hit on Netlify API.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (((Date.now() - startTime) / 1000) < REDUCED_TIMEOUT);

  // Timeout exceeded without finding a deployment.
  core.setFailed(
    `No build data found within the ${REDUCED_TIMEOUT} second timeout for Pull Request ${PR_NUMBER}`
  );
  process.exit();
};

const run = async () => {
  const build = await getBuildData(PR_NUMBER, startTime);
  if (build.done) {
    if (build.error) {
      core.setFailed(
        `Build failed with error "${build.error}"`
      );
      process.exit();
    }
  }

  const { id, deploy_id, sha } = build;
  do {
    core.info(`Checking build ${id} with deploy_id ${deploy_id} and sha ${sha}`);
    const deploy = await client.getDeploy({ deploy_id });

    if (deploy?.state === 'ready') {
      core.info(`Build was successful and is available at ${deploy.links.permalink}`);
      core.setOutput('deployUrl', deploy.links.permalink);
      process.exit(0);
    }
  } while (((Date.now() - startTime) / 1000) < MAX_TIMEOUT);

  // Timeout exceeded without the deployment succeeding.
  core.setFailed(
    `Unable to find a successful deployment within the timeout time.`
  );
  process.exit();
};

run();
