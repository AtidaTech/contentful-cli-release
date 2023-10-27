```dotenv
CMS_MANAGEMENT_TOKEN=env-management-token
CMS_SPACE_ID=env-space-id
CMS_RELEASE_SYNC_DB=./cli-release.db
CMS_RELEASE_SYNC_CONFIG=./cli-release-config.js
CMS_RELEASE_ENVIRONMENT_PROTECTED=dev,staging,master
CMS_RELEASE_ENVIRONMENT_REGEX=release-[0-9]+[\\.]*[0-9]*[\\.]*[0-9]*
```

```text
// --duplicate-master --to <env>
// Duplicate Master
// It should call duplicateEnvironment()
// Then enableCdaKey()
// then check timer 1s getEntry to see when new env is available

// --sync-current-master --from <env>
// Sync Current master
// Should use contentful-lib-sync and a configuration file (./cli-release-config.js)
// CMS_RELEASE_DB=./cli-release.db
// CMS_RELEASE_CONFIG=./cli-release-config.js

// --sync-scheduled-actions --from <env>
// Sync Scheduled actions
// Should straight call syncScheduledActions()

// --link-master --from <env> --prune-old-releases
// Link master to environment
// Should use lib.linkAliasToEnvironment()
// Prune old release
// Should use the same REGEX and deleteEnvironment to delete old releases.

// validateEnvironments()
// Internal function to validate 'from' and 'to' environment naming schema
// CMS_RELEASE_ENVIRONMENT_MAIN -> usually 'master' environment
// CMS_RELEASE_ENVIRONMENT_REGEX -> Regular Expression, ie for 'release-x.y.z'

```

```shell
npx contentful-cli-release --duplicate              --from "master"        --to "release-0.0.2"
npx contentful-cli-release --sync-schedule          --from "master"        --to "release-0.0.2"              --force-yes
npx contentful-cli-release --sync-entries           --from "staging"       --to "master"                     --force-yes
npx contentful-cli-release --link                   --alias "master"       --environment-id "release-0.0.3"  --prune-old-releases
                                                   (--from)               (--to)
npx contentful-cli-release --delete                                        --environment-id "master"         --force-yes
                                                                          (--to)
```

```shell
--space-id XXXX
--management-token
--sync-db
--sync-config
--protected-environments
--release-regex
```