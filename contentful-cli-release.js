#! /usr/bin/env node

const PLACEHOLDER_MANAGEMENT_TOKEN = 'placeholder-management-token'
const PLACEHOLDER_SPACE_ID = 'placeholder-space-id'
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

    console.log(parsedArguments)

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
      //   case 2:
      //     await syncScheduledActions(
      //       contentfulManagement,
      //       contentfulLib,
      //       spaceSingleton,
      //       parsedArguments
      //     )
      //     result = true
      //     break
      //   //      case 3:
      //   //        await linkAlias(contentful, parsedValues)
      //   //        break;
      //   //     case 4:
      //   //         await syncEnvironments(contentful, parsedValues)
      //   //         break;
    }

    if (!result) {
      console.error('@@/ERROR: No action chosen. Please try again')
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
 * @property {string} CMS_MANAGEMENT_TOKEN - The CMA token for Contentful.
 * @property {string} CMS_SPACE_ID - The Space ID.
 * @property {string} CMS_RELEASE_SYNC_DB - The SQLite database file for the sync.
 * @property {string} CMS_RELEASE_SYNC_CONFIG - The JS config file for the sync.
 * @property {string} CMS_RELEASE_ENVIRONMENT_PROTECTED - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} CMS_RELEASE_ENVIRONMENT_REGEX - A regular expression for the release branches, usually 'release-x.y.z'.
 * @returns {Promise<object>} The initial settings.
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {number} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentFrom - The FROM environmentId.
 * @property {String} environmentTo - The TO environmentId.
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
    protectedEnvironments,
    releaseRegularExpression
  }
}

/**
 * This function checks arguments and extract the environmentId
 *
 * @param {Object} parsedArgs - The object that contains the parsed command line arguments.
 * @property {string} from - The FROM environment
 * @property {string} to - The TO environment
 * @property {string} mt - The Contentful Management Token
 * @property {string} management-token - The Contentful Management Token
 * @property {string} alias - The Environment Alias for '--link'
 * @property {string} environment-id - The Environment-id for '--link' or '--delete'
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
 * @param {Object} parsedArguments
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentFrom - The FROM environmentId.
 * @property {String} environmentTo - The TO environmentId.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
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
 * @param {Object} parsedValues
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentFrom - The FROM environmentId.
 * @property {String} environmentTo - The TO environmentId.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @return {Promise<void>}
 */
async function validateEnvironments(
  contentfulManagement,
  contentfulLib,
  parsedValues
) {
  if (
    (await contentfulLib.getEnvironment(
      contentfulManagement,
      parsedValues.managementToken,
      parsedValues.spaceId,
      parsedValues.environmentFrom
    )) === null
  ) {
    console.error('@@/ERROR: The source environment does not exist!')
    process.exit(1)
  }

  const excludedEnvironments = parsedValues.protectedEnvironments.split(',')
  if (
    (excludedEnvironments.includes(parsedValues.environmentTo) &&
      [2, 3, 5].includes(parsedValues.chosenAction) &&
      !parsedValues?.forceYes) ||
    parsedValues.environmentTo === ''
  ) {
    console.error(
      '@@/ERROR: The destination environment is either empty or reserved!'
    )
    process.exit(1)
  }

  // const regex = new RegExp(parsedValues.releaseRegularExpression, 'g')
  // if (!parsedValues.environmentTo.match(regex)) {
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
 * @param {Object} parsedArguments
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentFrom - The FROM environmentId.
 * @property {String} environmentTo - The TO environmentId.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
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
        'assigned to environment ' +
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
              ' successfully duplicated from ' +
              parsedArguments?.environmentFrom
          )

          // Success, therefore clear the interval
          clearInterval(intervalObj)
        })
        .catch(e => {
          console.log(
            '%%/DEBUG: Waiting to retrieve the newly created environment ' +
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
 * Sync scheduled actions from the old to the new master
 *
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {import("contentful-management/dist/typings/entities/space").Space} spaceSingleton - A Contentful Space object
 * @param {Object} parsedArguments
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} forceYes - It will override the protected environments.
 * @property {boolean} updateApiKey - Updates the API key with same environment name when duplicating an environment.
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentFrom - The FROM environmentId.
 * @property {String} environmentTo - The TO environmentId.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
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
}
