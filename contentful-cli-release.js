#! /usr/bin/env node

import { linkAliasToEnvironment } from 'contentful-lib-helpers'

const PLACEHOLDER_MANAGEMENT_TOKEN = 'placeholder-management-token'
const PLACEHOLDER_SPACE_ID = 'placeholder-space-id'
const RELEASE_MAX_SCHEDULED_ACTIONS = 500
const RELEASE_SYNC_DB = './cli-release.db'
const RELEASE_SYNC_CONFIG = './cli-release-config.js'
const RELEASE_ENVIRONMENT_PROTECTED = 'dev,staging,master'
const RELEASE_ENVIRONMENT_REGEX = 'release-[0-9]+[\\.]*[0-9]*[\\.]*[0-9]*'
//const DEFAULT_LOCALE = 'en-US' - NOT USED FOR NOW

;(async function main() {
  try {
    const localWorkingDir = process.cwd()
    const scriptDirectory = await getDirNamePath()
    const contentfulManagement = (await import('contentful-management')).default
    const contentfulLib = await import('contentful-lib-helpers')

    const envValues = await getEnvValues(localWorkingDir, scriptDirectory)
    const parsedArguments = await parseArguments(localWorkingDir, envValues)

    const spaceSingleton = await getSpace(
      contentfulManagement,
      contentfulLib,
      parsedArguments
    )

    let result = false

    switch (parsedArguments.chosenAction) {
      case 1:
        await duplicateEnvironment(
          contentfulManagement,
          contentfulLib,
          spaceSingleton,
          parsedArguments
        )
        result = true
        break
      // case 2:
      //   await syncEnvironments(
      //       contentfulManagement,
      //       contentfulLib,
      //       spaceSingleton,
      //       parsedArguments
      //   )
      //   result = true
      //   break
      case 3:
        await syncScheduledActions(
          contentfulManagement,
          contentfulLib,
          spaceSingleton,
          parsedArguments
        )
        result = true
        break
      case 4:
        await contentfulLib.linkAliasToEnvironment(
          spaceSingleton,
          parsedArguments?.environmentTo, // environment
          parsedArguments?.environmentFrom, // alias
          parsedArguments?.releaseRegularExpression,
          parsedArguments?.protectedEnvironments,
          parsedArguments?.pruneOldReleases,
          3 // Max verbosity level for extended logging in CLI
        )
        result = true
        break
      case 5:
        result = await contentfulLib.deleteEnvironment(
          await spaceSingleton.getEnvironment(parsedArguments?.environmentTo),
          3, // Max verbosity level for extended logging in CLI
          parsedArguments?.protectedEnvironments.split(',')
        )
        break
    }

    if (!result) {
      console.error(
        '@@/ERROR: No action chosen or Returned an error. Inspect the logs and try again'
      )
    }
  } catch (error) {
    console.error('@@/ERROR:', error)
  }
})()

/**
 * Reads environment values from .env files.
 *
 * @param {string} localWorkingDir - The directory path where the .env files are located.
 * @param {string} scriptDirectory - The directory path where the library is installed
 * @return {Promise<object>} The environment values.
 * @property {string} CMS_MANAGEMENT_TOKEN - The CMA token for Contentful.
 * @property {string} CMS_SPACE_ID - The Space ID.
 * @property {string} CMS_RELEASE_MAX_SCHEDULED_ACTIONS - Max number of scheduled actions to retrieve.
 * @property {string} CMS_RELEASE_SYNC_DB - The SQLite database file for the sync.
 * @property {string} CMS_RELEASE_SYNC_CONFIG - The JS config file for the sync.
 * @property {string} CMS_RELEASE_ENVIRONMENT_PROTECTED - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} CMS_RELEASE_ENVIRONMENT_REGEX - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 */
async function getEnvValues(localWorkingDir, scriptDirectory) {
  const { existsSync } = await import('fs')
  const { config } = await import('dotenv')

  const envDataFromPath = path =>
    existsSync(path) ? config({ path }).parsed : {}

  const paths = [
    `${scriptDirectory}/../../.env`,
    `${scriptDirectory}/../../.env.local`,
    `${localWorkingDir}/.env`,
    `${localWorkingDir}/.env.local`
  ]

  const envValues = paths.map(envDataFromPath)

  return Object.assign({}, ...envValues)
}

/**
 * Gets the current directory's path.
 *
 * @return {Promise<string>} The path of the current directory.
 */
async function getDirNamePath() {
  const { fileURLToPath } = await import('url')
  const { dirname } = await import('path')

  const __filename = fileURLToPath(import.meta.url)
  return dirname(__filename)
}

/**
 * Parses command line arguments and sets default values.
 *
 * @param {string} rootFolder - The directory path where the .env files are located.
 * @param {Object} envValues - The .env values loaded.
 * @property {string} envValues.CMS_MANAGEMENT_TOKEN - The CMA token for Contentful.
 * @property {string} envValues.CMS_SPACE_ID - The Space ID.
 * @property {string} envValues.CMS_RELEASE_MAX_SCHEDULED_ACTIONS - Max number of scheduled actions to retrieve.
 * @property {string} envValues.CMS_RELEASE_SYNC_DB - The SQLite database file for the sync.
 * @property {string} envValues.CMS_RELEASE_SYNC_CONFIG - The JS config file for the sync.
 * @property {string} envValues.CMS_RELEASE_ENVIRONMENT_PROTECTED - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} envValues.CMS_RELEASE_ENVIRONMENT_REGEX - A regular expression for the release branches, usually 'release-x.y.z'.
 * @returns {Promise<object>} The initial settings.
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {number} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {String} environmentFrom - The FROM environmentId. (or --alias when linking alias to environment)
 * @property {String} environmentTo - The TO environmentId. (or --environment-id when using --link or --delete)
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {string} maxScheduledActions - The Max number of scheduled actions to retrieve during sync-schedule.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @throws {Error} If '--from' and '--to' are not provided, or if '--management-token' or '--mt' are duplicated.
 */
async function parseArguments(rootFolder, envValues) {
  const minimist = (await import('minimist')).default
  const parsedArgs = minimist(process.argv.slice(2))

  const {
    'space-id': spaceId = envValues?.CMS_SPACE_ID ?? PLACEHOLDER_SPACE_ID,
    'management-token': managementToken = parsedArgs['mt'] ??
      envValues?.CMS_MANAGEMENT_TOKEN ??
      PLACEHOLDER_MANAGEMENT_TOKEN,
    'force-yes': forceYes = false,
    'update-api-key': updateApiKey = false,
    'prune-old-releases': pruneOldReleases = false,
    'sync-db': syncPath = envValues?.CMS_RELEASE_SYNC_DB ?? RELEASE_SYNC_DB,
    'sync-config': configPath = envValues?.CMS_RELEASE_SYNC_CONFIG ??
      RELEASE_SYNC_CONFIG,
    'max-scheduled-actions':
      maxScheduledActions = envValues?.CMS_RELEASE_MAX_SCHEDULED_ACTIONS ??
        RELEASE_MAX_SCHEDULED_ACTIONS,
    'protected-environments':
      protectedEnvironments = envValues?.CMS_RELEASE_ENVIRONMENT_PROTECTED ??
        RELEASE_ENVIRONMENT_PROTECTED,
    'release-regex':
      releaseRegularExpression = envValues?.CMS_RELEASE_ENVIRONMENT_REGEX ??
        RELEASE_ENVIRONMENT_REGEX
  } = parsedArgs

  const argNames = [
    'duplicate',
    'sync-entries',
    'sync-schedule',
    'link',
    'delete'
  ]
  const chosenAction =
    argNames.findIndex(arg => parsedArgs.hasOwnProperty(arg)) + 1 || 0
  const cleanedEnvs = await getEnvsFromArgs(parsedArgs, chosenAction)
  let environmentFrom = cleanedEnvs?.environmentFrom
  let environmentTo = cleanedEnvs?.environmentTo

  return {
    managementToken,
    spaceId,
    chosenAction,
    forceYes,
    updateApiKey,
    pruneOldReleases,
    environmentFrom,
    environmentTo,
    syncPath,
    configPath,
    maxScheduledActions,
    protectedEnvironments,
    releaseRegularExpression
  }
}

/**
 * This function checks arguments and extract the environmentId
 *
 * @param {Object} parsedArgs - The object that contains the parsed command line arguments.
 * @property {string} parsedArgs.from - The FROM environment
 * @property {string} parsedArgs.to - The TO environment
 * @property {string} parsedArgs.mt - The Contentful Management Token
 * @property {string} parsedArgs.management-token - The Contentful Management Token
 * @property {string} parsedArgs.alias - The Environment Alias for '--link'
 * @property {string} parsedArgs.environment-id - The Environment-id for '--link' or '--delete'
 * @param {number} chosenAction - The chosen action
 * @returns {Promise<{environmentTo: string, environmentFrom: string}>}
 *
 * @throws {Error} If 'from' and 'to' options are not specified.
 * @throws {Error} If both 'management-token' and 'mt' options are specified.
 */
async function getEnvsFromArgs(parsedArgs, chosenAction) {
  const {
    from,
    to,
    mt,
    'management-token': managementToken,
    'environment-id': environmentId,
    alias
  } = parsedArgs

  if (chosenAction < 4 && (!from || !to)) {
    console.error(
      "@@/ERROR: You should specify both a '--from' and a '--to' option."
    )
    process.exit(1)
  }

  if (managementToken && mt) {
    console.error(
      "@@/ERROR: Only one of the two options '--management-token' or '--mt' can be specified"
    )
    process.exit(1)
  }

  if (chosenAction >= 4) {
    if (!(environmentId || to)) {
      console.error(
        "@@/ERROR: You should specify an '--environment-id' option when using '--delete' or '--link'"
      )
      process.exit(1)
    }
  }

  if (chosenAction === 4 && !(alias || from)) {
    console.error(
      "@@/ERROR: You should specify an '--alias' option when using '--link'"
    )
    process.exit(1)
  }

  const environmentFrom = chosenAction === 5 ? undefined : alias || from
  const environmentTo = environmentId || to

  return { environmentFrom, environmentTo }
}

/**
 * Check if the destination environment exists before running the migration(s)
 *
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {Object} parsedArguments - Parsed arguments object.
 * @param {string} parsedArguments.managementToken - The CMS Management Token.
 * @param {string} parsedArguments.spaceId - The CMS Space ID.
 * @param {string} parsedArguments.chosenAction - The Chosen action (sync, duplicate, etc.).
 * @param {boolean} parsedArguments.forceYes - It will override the protected environments.
 * @param {boolean} parsedArguments.updateApiKey - Updates the API key with the same environment name when duplicating an environment.
 * @param {boolean} parsedArguments.pruneOldReleases - If it should prune old releases when linking the new master env.
 * @param {string} parsedArguments.environmentFrom - The FROM environmentId.
 * @param {string} parsedArguments.environmentTo - The TO environmentId.
 * @param {string} parsedArguments.syncPath - The SQLite database file for the sync.
 * @param {string} parsedArguments.configPath - The JS config file for the sync.
 * @param {string} parsedArguments.maxScheduledActions - The Max number of scheduled actions to retrieve during sync-schedule.
 * @param {string} parsedArguments.protectedEnvironments - A list of protected environments, usually 'dev,staging,master'.
 * @param {string} parsedArguments.releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @returns {Promise<import("contentful-management/dist/typings/entities/space").Space|null>} - A Promise that resolves with the Space object, or `null` if not found.
 */
async function getSpace(contentfulManagement, contentfulLib, parsedArguments) {
  const spaceSingleton = await contentfulLib.getSpace(
    contentfulManagement,
    parsedArguments?.managementToken,
    parsedArguments?.spaceId,
    0
  )

  if (!spaceSingleton) {
    console.error(
      `@@/ERROR: Unable to retrieve Destination space-id '${parsedArguments?.spaceId}'!`
    )
    console.error(
      `@@/ERROR: Could also be that the management token or space-id are invalid.`
    )
    process.exit(1)
  }

  return spaceSingleton
}

/**
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {Object} parsedArguments - Parsed arguments object.
 * @param {string} parsedArguments.managementToken - The CMS Management Token.
 * @param {string} parsedArguments.spaceId - The CMS Space ID.
 * @param {number} parsedArguments.chosenAction - The Chosen action (sync, duplicate, etc.).
 * @param {boolean} parsedArguments.forceYes - It will override the protected environments.
 * @param {boolean} parsedArguments.updateApiKey - Updates the API key with the same environment name when duplicating an environment.
 * @param {boolean} parsedArguments.pruneOldReleases - If it should prune old releases when linking the new master env.
 * @param {string} parsedArguments.environmentFrom - The FROM environmentId.
 * @param {string} parsedArguments.environmentTo - The TO environmentId.
 * @param {string} parsedArguments.syncPath - The SQLite database file for the sync.
 * @param {string} parsedArguments.configPath - The JS config file for the sync.
 * @param {string} parsedArguments.maxScheduledActions - The Max number of scheduled actions to retrieve during sync-schedule.
 * @param {string} parsedArguments.protectedEnvironments - A list of protected environments, usually 'dev,staging,master'.
 * @param {string} parsedArguments.releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @return {Promise<void>}
 */
async function validateEnvironments(
  contentfulManagement,
  contentfulLib,
  parsedArguments
) {
  if (
    (await contentfulLib.getEnvironment(
      contentfulManagement,
      parsedArguments.managementToken,
      parsedArguments.spaceId,
      parsedArguments.environmentFrom,
      0
    )) === null
  ) {
    console.error('@@/ERROR: The source environment does not exist!')
    process.exit(1)
  }

  const excludedEnvironments = parsedArguments.protectedEnvironments.split(',')
  if (
    (excludedEnvironments.includes(parsedArguments.environmentTo) &&
      // 2 - sync-entries / 3 - sync-scheduled / 5 - delete environment
      [2, 3, 5].includes(parsedArguments.chosenAction) &&
      !parsedArguments?.forceYes) ||
    parsedArguments.environmentTo === ''
  ) {
    console.error(
      '@@/ERROR: The destination environment is either empty or reserved!'
    )
    process.exit(1)
  }

  // const regex = new RegExp(parsedArguments.releaseRegularExpression, 'g')
  // if (!parsedArguments.environmentTo.match(regex)) {
  //   console.error(
  //     '@@/ERROR: The destination environment should be following the proper naming convention.'
  //   )
  //   process.exit(1)
  // }
}

/**
 * Duplicate the current master into a new environment
 *
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {import("contentful-management/dist/typings/entities/space").Space} spaceSingleton - A Contentful Space object
 * @param {Object} parsedArguments - Parsed arguments object.
 * @param {string} parsedArguments.managementToken - The CMS Management Token.
 * @param {string} parsedArguments.spaceId - The CMS Space ID.
 * @param {number} parsedArguments.chosenAction - The Chosen action (sync, duplicate, etc.).
 * @param {boolean} parsedArguments.forceYes - It will override the protected environments.
 * @param {boolean} parsedArguments.updateApiKey - Updates the API key with the same environment name when duplicating an environment.
 * @param {boolean} parsedArguments.pruneOldReleases - If it should prune old releases when linking the new master env.
 * @param {string} parsedArguments.environmentFrom - The FROM environmentId.
 * @param {string} parsedArguments.environmentTo - The TO environmentId.
 * @param {string} parsedArguments.syncPath - The SQLite database file for the sync.
 * @param {string} parsedArguments.configPath - The JS config file for the sync.
 * @param {string} parsedArguments.maxScheduledActions - The Max number of scheduled actions to retrieve during sync-schedule.
 * @param {string} parsedArguments.protectedEnvironments - A list of protected environments, usually 'dev,staging,master'.
 * @param {string} parsedArguments.releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @returns {Promise<void>}
 */
async function duplicateEnvironment(
  contentfulManagement,
  contentfulLib,
  spaceSingleton,
  parsedArguments
) {
  await validateEnvironments(
    contentfulManagement,
    contentfulLib,
    parsedArguments
  )

  const duplicatedEnvironment = await contentfulLib.duplicateEnvironment(
    spaceSingleton,
    parsedArguments?.environmentFrom,
    parsedArguments?.environmentTo,
    3
  )

  if (duplicatedEnvironment && parsedArguments?.updateApiKey) {
    // Enable the CDA key for the new duplicated environment
    // The CDA key should be named as the environmentFrom
    const creationKeyResult = await contentfulLib.enableCdaKey(
      spaceSingleton,
      parsedArguments?.environmentFrom,
      parsedArguments?.environmentTo
    )

    console.log(
      "##/INFO: CDA '" +
        parsedArguments?.environmentFrom +
        "' Key " +
        (creationKeyResult ? '' : 'NOT ') +
        'assigned to environment: ' +
        parsedArguments?.environmentTo
    )
  }

  if (duplicatedEnvironment) {
    // Wait few seconds before checking if environment is available. It might not be
    let intervalObj = setInterval(async () => {
      await duplicatedEnvironment
        .getEntries({ limit: 1 })
        .then(entries => {
          console.log(
            '##/INFO: ' +
              parsedArguments?.environmentTo +
              ' successfully duplicated from: ' +
              parsedArguments?.environmentFrom
          )

          // Success, therefore clear the interval
          clearInterval(intervalObj)
        })
        .catch(e => {
          console.log(
            '%%/DEBUG: Waiting to retrieve the newly created environment: ' +
              parsedArguments?.environmentTo
          )
        })
    }, 1000)
  } else {
    console.error(
      `@@/ERROR: There was an error duplicating the environment ${parsedArguments?.environmentTo}`
    )
    console.error(
      '@@/ERROR: Please check the input parameters and investigate the previous error messages for more details'
    )
  }
}

/**
 * Sync scheduled actions between two environments.
 *
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {import("contentful-management/dist/typings/entities/space").Space} spaceSingleton - A Contentful Space object.
 * @param {Object} parsedArguments - Parsed arguments object.
 * @param {string} parsedArguments.managementToken - The CMS Management Token.
 * @param {string} parsedArguments.spaceId - The CMS Space ID.
 * @param {number} parsedArguments.chosenAction - The Chosen action (sync, duplicate, etc.).
 * @param {boolean} parsedArguments.forceYes - It will override the protected environments.
 * @param {boolean} parsedArguments.updateApiKey - Updates the API key with the same environment name when duplicating an environment.
 * @param {boolean} parsedArguments.pruneOldReleases - If it should prune old releases when linking the new master env.
 * @param {string} parsedArguments.environmentFrom - The FROM environmentId.
 * @param {string} parsedArguments.environmentTo - The TO environmentId.
 * @param {string} parsedArguments.syncPath - The SQLite database file for the sync.
 * @param {string} parsedArguments.configPath - The JS config file for the sync.
 * @param {string} parsedArguments.maxScheduledActions - The Max number of scheduled actions to retrieve during sync-schedule.
 * @param {string} parsedArguments.protectedEnvironments - A list of protected environments, usually 'dev,staging,master'.
 * @param {string} parsedArguments.releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @returns {Promise<void>}
 */
async function syncScheduledActions(
  contentfulManagement,
  contentfulLib,
  spaceSingleton,
  parsedArguments
) {
  await validateEnvironments(
    contentfulManagement,
    contentfulLib,
    parsedArguments
  )

  const srcEnvironment = parsedArguments?.environmentFrom ?? 'master'
  const limit = parsedArguments?.maxScheduledActions ?? 500

  let scheduledActions
  try {
    scheduledActions = await spaceSingleton.getScheduledActions({
      'environment.sys.id': srcEnvironment,
      'sys.status': 'scheduled',
      limit: limit
    })
  } catch (e) {
    console.error('@@/ERROR: ' + e)
    return
  }

  console.log("##/INFO: Source Environment: '" + srcEnvironment + "'")

  // Fetch existing scheduled actions from destination environment for deduplication
  let destScheduledActions,
    destEnvironment = parsedArguments?.environmentTo ?? 'undefined'
  try {
    destScheduledActions = await spaceSingleton.getScheduledActions({
      'environment.sys.id': destEnvironment,
      'sys.status': 'scheduled',
      limit: limit
    })
  } catch (e) {
    console.error(
      "@@/ERROR: Destination environment '" +
        destEnvironment +
        "' does not exist."
    )
    return
  }

  logScheduledItemInfo(scheduledActions, destEnvironment)

  for (const scheduledItem of scheduledActions?.items || []) {
    const actionExists = destScheduledActions.items.some(
      item =>
        item.entity.sys.id === scheduledItem.entity.sys.id &&
        item.entity.sys.linkType === scheduledItem.entity.sys.linkType &&
        item.entity.action === scheduledItem.entity.action &&
        item.scheduledFor.datetime === scheduledItem.scheduledFor.datetime &&
        item.scheduledFor.timezone === scheduledItem.scheduledFor.timezone
    )

    if (scheduledItem && destEnvironment && !actionExists) {
      try {
        const scheduledAction = await spaceSingleton.createScheduledAction({
          entity: {
            sys: {
              type: 'Link',
              linkType: 'Entry',
              id: scheduledItem?.entity?.sys?.id
            }
          },
          environment: {
            sys: {
              type: 'Link',
              linkType: 'Environment',
              id: parsedArguments.environmentTo
            }
          },
          action: scheduledItem?.action,
          scheduledFor: {
            datetime: scheduledItem?.scheduledFor?.datetime,
            timezone: scheduledItem?.scheduledFor?.timezone
          }
        })

        console.log(
          '%%/DEBUG: Imported scheduled action: ' +
            await formatScheduledAction(scheduledAction)
        )
      } catch (e) {
        console.error(
          '@@ERROR: Destination environment does not exist or has exceeded max scheduled actions.'
        )
      }
    } else {
      console.log(
        '%%/DEBUG: Scheduled action already exists - Action-Id: ' +
          scheduledItem?.sys?.id
      )
    }
  }
}

/**
 * Formats a scheduled action for logging.
 *
 * @param {Object} scheduledAction - The scheduled action to format.
 * @param {string} scheduledAction.action - The action type of the scheduled item.
 * @param {Object} scheduledAction.entity - Entity information of the scheduled action.
 * @param {Object} scheduledAction.entity.sys - System information of the entity.
 * @param {string} scheduledAction.entity.sys.linkType - Link type of the entity (e.g. 'Entry').
 * @param {string} scheduledAction.entity.sys.id - ID of the entity.
 * @param {Object} scheduledAction.scheduledFor - Scheduling details of the action.
 * @param {string} scheduledAction.scheduledFor.datetime - The datetime the action is scheduled for.
 *
 * @returns {Promise<string>} - A formatted string representation of the scheduled action.
 */
async function formatScheduledAction(scheduledAction) {
  const dayjs = (await import('dayjs')).default

  return (
    scheduledAction?.action[0].toUpperCase() +
    scheduledAction?.action.slice(1) +
    ' for ' +
    scheduledAction?.entity?.sys?.linkType +
    "-Id: '" +
    scheduledAction?.entity?.sys?.id +
    "' for the: " +
    dayjs(scheduledAction?.scheduledFor?.datetime).format('YYYY-MM-DD HH:mm')
  )
}

/**
 * Logs information related to scheduled actions and the destination environment.
 *
 * @param {Object} scheduledActions - The scheduled actions from the source environment.
 * @param {Object[]} scheduledActions.items - List of scheduled action items.
 * @param {string} destEnvironment - The ID of the destination environment.
 */
function logScheduledItemInfo(scheduledActions, destEnvironment) {
  console.log("##/INFO: Destination Environment: '" + destEnvironment + "'")
  console.log(
    '##/INFO: Total Scheduled Actions: ' + scheduledActions?.items?.length ?? 0
  )
}
