# andrewnicols/wait-for-netlify-preview

This action waits for the deploy preview for a pull request to complete

It checks the build for the correct pull request.


## Inputs

### `site_id`

**Required** The site_id of the Netlify site to test against.

### `max_timeout`

The max time to run the action.

## Outputs

### `deployUrl`

The site permalink

## Example usage

uses: andrewnicols/wait-for-netlify-preview
with:
  site_id: 'some-site-id'
