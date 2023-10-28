[![License: MIT](https://img.shields.io/github/license/AtidaTech/contentful-cli-release)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/contentful-cli-release)](https://npmjs.com/package/contentful-cli-release)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/AtidaTech/contentful-cli-release)
![Downloads](https://img.shields.io/npm/dw/contentful-cli-release)
![Forks](https://img.shields.io/github/forks/AtidaTech/contentful-cli-release)
[![Bun.sh](https://img.shields.io/badge/bun.sh-compatible-orange)](https://bun.sh)

# Contentful CLI Release Tool

This tool is a utility for managing releases in Contentful. It streamlines the process of branching, releasing, and 
integrating with CI/CD pipelines such as GitLab or GitHub.

<h3>Sponsored by <a href="https://github.com/AtidaTech"><b>Atida</b> 
<img src="https://avatars.githubusercontent.com/u/127305035?s=200&v=4" width="14px;" alt="Atida" /></a></h3>

<hr />

[✨ Features](#-features) · [💡 Installation](#-installation) · [📟 Example](#-example) · [🎹 Usage](#-usage) · 
[🚀 Release](#-managing-a-release) · [📅 ToDo](#-todo) · [👾 Contributors](#-contributors) ·
[🎩 Acknowledgments](#-acknowledgements) · [📚 Collection](#-other-scripts-in-the-same-collection) ·
[📄 License](#-license)

<hr />

## ✨ Features

* **Branching & Releasing:** Seamless management of environments and releases in Contentful.
* **CI/CD Integration:** Designed for integration with CI/CD pipelines like GitLab or GitHub.
* **Command Line Utility:** Efficient command-line interface for all release-related tasks.

## 💡 Installation

To use this helper library, you must have [NodeJS 🔗](https://nodejs.org/) and [npm 🔗](http://npmjs.org) installed.

To install it, simply run:

``````shell
npm install contentful-cli-release --save
``````

Or, if using [yarn 🔗](https://yarnpkg.com/lang/en/):

```shell
yarn add contentful-cli-release
```

Similarly, if you are using [Bun 🔗](https://bun.sh), just run:

```shell
bun add contentful-cli-release
```

### Requirements

* `node` >= 18
* `npm` >= 9.5.0
* `contentful-management` >= 7.50.0
* [contentful-lib-helpers](https://www.npmjs.com/package/contentful-lib-helpers) >= 0.2.1


### Set-up

To get the most out of the Contentful CLI Release tool, proper setup is crucial. Here's a step-by-step guide to help
you get started:

1. **Environment Variables**:
   The tool uses environment variables to simplify repetitive tasks and ensure security. Instead of passing sensitive 
   data as command line arguments every time, you can set them once in your environment. We recommend using a `.env` 
   file for this purpose. Here's a sample configuration:

   ```env
   CMS_MANAGEMENT_TOKEN=placeholder-management-token
   CMS_SPACE_ID=placeholder-space-id
   CMS_RELEASE_MAX_SCHEDULED_ACTIONS=500
   CMS_RELEASE_ENVIRONMENT_PROTECTED=dev,staging,master
   CMS_RELEASE_ENVIRONMENT_REGEX=release-[0-9]+[\\.]*[0-9]*[\\.]*[0-9]*
   ```
   
   Create the `.env` or `.env.local` files in your project to override the default configuration. But ensure to 
   replace the placeholders (e.g., `placeholder-management-token` and `placeholder-space-id`) with your actual data.

[//]: # (CMS_RELEASE_SYNC_DB=./cli-release.db)
[//]: # (CMS_RELEASE_SYNC_CONFIG=./cli-release-config.js)

2. **Max Scheduled Actions**:
   The `CMS_RELEASE_MAX_SCHEDULED_ACTIONS` parameter sets the number of scheduled actions (in total) to be retrieved. 
   Default and maximum value is `500`.

3. **Protected Environments**:
   The `CMS_RELEASE_ENVIRONMENT_PROTECTED` parameter lists environments that should not be modified by the tool, 
   ensuring safety for crucial stages like `dev`, `staging`, and `master`.

3. **Environment Naming Convention**:
   Using the `CMS_RELEASE_ENVIRONMENT_REGEX`, you can specify a regex pattern to match the naming convention of your 
   release environments. The default pattern matches names like `release-1`, `release-1.1`, and `release-1.1.1`.

With these steps, you should have a fully configured environment ready to utilize the Contentful CLI Release tool 
effectively. Always refer back to the tool's documentation if you need further assistance.

## 📟 Example

### Duplicate an Environment

Duplicates an existing environment to a new environment, and it pings to see when the new environment is available.
It skips the duplication if the destination environment already exists.

Usage:

```bash
npx contentful-cli-release --duplicate --from SOURCE_ENV --to DEST_ENV (--update-api-key)
```

Arguments:

- `--from`: The name of the source environment to duplicate from. Ie: 'master'.
- `--to`: The name of the destination environment to duplicate to. Ie: 'release-1.7.4' or 'staging'. 
- `--update-api-key`: It will enable, for the duplicated environment, the CDA API Key that has the same name of the 
  source environment (so, for environment 'master', the CDA API Key should be also called 'master').

> See the section [🎹 Usage](#-usage) for details on the command line options.

#### Response and Errors

<details>
  <summary>Successful duplication</summary>

```shell
$ npx contentful-cli-release --duplicate --from master --to release-1.7.4 --update-api-key
##/INFO: Duplicating environment 'master' for space 'xxxxxxxxx'
##/DEBUG: Creating new environment: 'release-1.7.4'
##/INFO: Environment 'release-1.7.4' successfully created
##/INFO: CDA 'master' Key assigned to environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
...
##/INFO: release-1.7.4 successfully duplicated from: master
```
</details>

<details>
  <summary>Skips creation, but associates the Key and pings the environment</summary>

```shell
$ npx contentful-cli-release --duplicate --from master --to release-1.7.4 --update-api-key
##/INFO: Duplicating environment 'master' for space 'xxxxxxxxx'
##/INFO: An environment with this name already exists: 'release-1.7.4'. Skipping creation
##/INFO: CDA 'master' Key assigned to environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
##/DEBUG: Waiting to retrieve the newly created environment: release-1.7.4
...
##/INFO: release-1.7.4 successfully duplicated from: master
```
</details>

<details>
  <summary>Error when Source environment doesn't exists</summary>

```shell
$ npx contentful-cli-release --duplicate --from myenvironment --to release-1.7.4
@@/ERROR: The source environment does not exist!
```
</details>

<details>
  <summary>Error when 'from' or 'to' environments are missing</summary>

```shell
$ npx contentful-cli-release --duplicate --from master
@@/ERROR: You should specify both a '--from' and a '--to' option.
```
</details>

### Sync Schedule

Synchronize scheduled actions between two Environments, because the actions are not copied when duplicating an 
Environment. Ideally the source is the 'old' master and the destination is the newly created release environment.

Usage:

```bash
npx contentful-cli-release --sync-schedule --from SOURCE_ENV --to DEST_ENV (--force-yes)
```

Arguments:

- `--from`: The name of the source environment where the existing scheduled actions are. Ie: 'master'.
- `--to`: The name of the destination environment to copy the scheduled actions to. Ie: 'release-1.4.5'.
- `--force-yes`: When the destination environment is protected, this will allow to perform the action.

> See the section [🎹 Usage](#-usage) for details on the command line options.

#### Response and Errors

<details>
  <summary>Successful sync between two Environments</summary>

```shell
$ npx contentful-cli-release --sync-schedule --from master --to release-1.4.5 --force-yes
##/INFO: Source Environment: 'master'
##/INFO: Destination Environment: 'release-1.4.5'
##/INFO: Total Scheduled Actions: 2
##/DEBUG: Imported scheduled action: Publish for Entry-Id: '5krek3qkuRtWxRyIqM012a' for the: 2023-10-29 19:00
##/DEBUG: Imported scheduled action: Unpublish for Entry-Id: 'GKfodiofTQFS8oXjJp65Yb' for the: 2023-10-29 20:00
```
</details>


<details>
  <summary>Skips already imported actions (to avoid duplicates)</summary>

```shell
$ npx contentful-cli-release --sync-schedule --from master --to release-1.4.5 --force-yes
##/INFO: Source Environment: 'master'
##/INFO: Destination Environment: 'release-1.4.5'
##/INFO: Total Scheduled Actions: 2
##/DEBUG: Scheduled action already exists - Action-Id: 6jTzhTAOPs5LsbpjRZKkF3
##/DEBUG: Scheduled action already exists - Action-Id: 2HVGh3wJRSp8P6ZW18YI92
```
</details>

<details>
  <summary>Error when 'to' Environment is protected</summary>

```shell
$ npx contentful-cli-release --sync-schedule --from master --to release-1.4.5
@@/ERROR: The destination environment is either empty or reserved!
```
</details>

<details>
  <summary>Error when 'from' or 'to' Environments are missing</summary>

```shell
$ npx contentful-cli-release --sync-schedule --from master
@@/ERROR: You should specify both a '--from' and a '--to' option.
```
</details>

### Link Alias
It links an existing alias from one Environment to another one. This is used during a Release to move, for example,
the 'master' alias from the old release branch to the new one

Usage:

```bash
npx contentful-cli-release --link --alias ALIAS --environment-id TARGET_ENV (--prune-old-releases)
```

Arguments:

- `--alias`: The existing alias that needs to be updated. Ie: 'master'.
- `--to`: The target Environment-id to which the alias will point to. Ie: 'release-1.4.5'.
- `--prune-old-releases`: Using the release regular expression, it will delete all the older releases, except
the current one (ie: 'release-1.4.5') and the previous one (ie: 'release-1.4.4') that was associated with the 
'master' alias.

> See the section [🎹 Usage](#-usage) for details on the command line options.

#### Response and Errors

<details>
  <summary>Successful use with the '--prune-old-releases' option</summary>

```shell
$ npx contentful-cli-release --link --alias master --environment-id release-1.4.5 --prune-old-releases
##/INFO: Linking Environment 'release-1.4.5' to Alias 'master'
##/INFO: Alias 'master' updated to 'release-1.4.5' Environment.
##INFO: Deleting old Release Environments
##/INFO: Processing the list of all environments
##/INFO: This environment will NOT be deleted: dev
##/INFO: This environment will NOT be deleted: staging
##/INFO: This environment will NOT be deleted: release-1.4.5 aliased by master
##/INFO: List of Release environments that will be kept:
- release-1.4.5
- release-1.4.4
##/INFO: List of Release environments that will be deleted:
- release-1.4.3
##/DEBUG: Environment 'release-1.4.3' is going to be deleted!
##/INFO: Deleting environment 'release-1.4.3'.
##/DEBUG: Environment 'release-1.4.3' was deleted.
```
</details>

<details>
  <summary>Successful use without the '--prune-old-releases' option</summary>

```shell
$ npx contentful-cli-release --link --alias master --environment-id release-1.4.5
##/INFO: Linking Environment 'release-1.4.5' to Alias 'master'
##/INFO: Alias 'master' updated to 'release-1.4.5' Environment.
```
</details>

<details>
  <summary>Error when '--alias' is missing</summary>

```shell
$ npx contentful-cli-release --link --environment-id release-1.4.5
@@/ERROR: You should specify an '--alias' option when using '--link'
```
</details>

<details>
  <summary>Error when '--environment-id' is missing</summary>

```shell
$ npx contentful-cli-release --link --alias master
@@/ERROR: You should specify an '--environment-id' option when using '--delete' or '--link'
```
</details>

### Delete an Environment

## 🎹 Usage

This script can be used from the command line and accepts various arguments for customization:

[//]: # (* `--space-id`: The Contentful space id.)
[//]: # (* `--management-token` or `--mt`: The Contentful Management Token.)
[//]: # (* `--to` or `--environment-id` [MANDATORY]: )
[//]: # (* `--force-yes`: The script runs a migration at a time, asking you to confirm it manually &#40;Y/N&#41;.)
[//]: # (In a CD/CI pipeline, you will need to set up `--force-yes` so that all migrations will run without any request)
[//]: # (for interaction.)


## 🚀 Managing a Release


## 📅 Todo

* Add a '--sync-entries' option to sync entries between two releases.
* Add a '--help' command to describe the available command line options.
* Extend compatibility with other Contentful tools and integrations.
* Improve logging and error handling for more transparent releases.
* Incorporate feedback from the community to enhance tool capabilities.

## 👾 Contributors

<table>
  <tr>
    <td align="center"><a href="https://github.com/fciacchi"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/58506?v=4&h=100&w=100&fit=cover&mask=circle&maxage=7d" width="100px;" alt="Fabrizio Ciacchi" /><br /><sub><b>@fciacchi</b></sub></a><br /></td>
    <td align="center"><a href="https://github.com/aalduz"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/11409770?v=4&h=100&w=100&fit=cover&mask=circle&maxage=7d" width="100px;" alt="Aldo Fernández" /><br /><sub><b>@aalduz</b></sub></a><br /></td>
  </tr>
</table>

### Contributions
Feel free to open issues or pull requests in our GitHub Repository if you have suggestions or improvements to propose.

## 🎩 Acknowledgements

I would like to express my gratitude to the following parties:

* [Atida 🔗](https://www.atida.com/), the company that has allowed these scripts to be open sourced. Atida is an 
  e-commerce platform that sells beauty and medical products. Their support for open source is greatly appreciated. 
  A special thank to <a href="https://github.com/shoopi"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/1385372?v=4&h=16&w=16&fit=cover&mask=circle&maxage=7d" width="16px;" alt="Shaya Pourmirza" /> Shaya Pourmirza</a> 
  that has been a great promoter and supporter of this initiative inside the company.
* [Contentful 🔗](https://www.contentful.com/), for creating their excellent content management platform and the 
  JavaScript CMA SDK that this library is built on. Without their work, this project would not be possible.

Thank you to everyone involved!

## 📚 Other Scripts in the same collection

We produce a bunch of interesting packages for Contentful. You might want to check them out:

* **Contentful Lib Helpers** ([GitHub](https://github.com/AtidaTech/contentful-lib-helpers/) and [NpmJS](https://www.npmjs.com/package/contentful-lib-helpers)): Utility Library for Contentful Management API.
* **Contentful CLI Export** ([GitHub](https://github.com/AtidaTech/contentful-cli-export/) and [NpmJS](https://www.npmjs.com/package/contentful-cli-export)): Simplifies backup of your Contentful Environment.
* **Contentful CLI Migrations** ([GitHub](https://github.com/AtidaTech/contentful-cli-migrations/) and [NpmJS](https://www.npmjs.com/package/contentful-cli-migrations)): Tool to automate and scale Contentful Migrations.
* **Contentful CLI Release** ([GitHub](https://github.com/AtidaTech/contentful-cli-release/) and [NpmJS](https://www.npmjs.com/package/contentful-cli-release)): Release utilities to deploy Contentful in a CI/CD.

[//]: # (* **Contentful CLI Sync** &#40;[GitHub]&#40;https://github.com/AtidaTech/contentful-cli-sync/&#41; and )
[//]: # ([NpmJS]&#40;https://www.npmjs.com/package/contentful-cli-sync&#41;&#41;: Contentful tool to sync data )
[//]: # (across Spaces and Environments.)

## 📄 License
This project is licensed under the [MIT License](LICENSE)