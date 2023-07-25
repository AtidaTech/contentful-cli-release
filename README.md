```dotenv
CMS_MANAGEMENT_TOKEN=env-management-token
CMS_SPACE_ID=env-space-id
CMS_RELEASE_DB=./cli-release.db
CMS_RELEASE_CONFIG=./cli-release-config.js
CMS_RELEASE_ENVIRONMENT_MAIN=master
CMS_RELEASE_ENVIRONMENT_PROTECTED=dev,staging,master
CMS_RELEASE_ENVIRONMENT_REGEX=release-[0-9]+[\\.]*[0-9]*[\\.]*[0-9]*
```

```text
// --duplicate-master -to <env>
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