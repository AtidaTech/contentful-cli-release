#! /usr/bin/env node

const PLACEHOLDER_MANAGEMENT_TOKEN = 'placeholder-management-token'
const PLACEHOLDER_SPACE_ID = 'placeholder-space-id'
const RELEASE_DB = './cli-release.db'
const RELEASE_CONFIG = './cli-release-config.js'
const RELEASE_ENVIRONMENT_MAIN = 'master'
const RELEASE_ENVIRONMENT_PROTECTED = 'dev,staging,master'
const RELEASE_ENVIRONMENT_REGEX = 'release-[0-9]+[\\.]*[0-9]*[\\.]*[0-9]*'
// const DEFAULT_LOCALE = 'en-US'

;(async function main() {
  try {
    const localeWorkingDir = process.cwd()
    const scriptDirectory = await getDirNamePath()
    const contentfulManagement = (await import('contentful-management')).default
    const contentfulLib = await import('contentful-lib-helpers')

    const envValues = await getEnvValues(localeWorkingDir, scriptDirectory)
    const parsedArguments = await parseArguments(localeWorkingDir, envValues)

    console.log(parsedArguments)
    const spaceSingleton = await getSpace(
      contentfulManagement,
      contentfulLib,
      parsedArguments
    )

    switch (parsedArguments.chosenAction) {
      case 1:
        await duplicateMaster(
          contentfulManagement,
          contentfulLib,
          spaceSingleton,
          parsedArguments
        )
        break
      case 2:
        await syncScheduledActions(
          contentfulManagement,
          contentfulLib,
          spaceSingleton,
          parsedArguments
        )
        break
      //     case 3:
      //         await linkMasterAlias(contentful, parsedValues)
      //         break;
      //     case 4:
      //         await syncCurrentMaster(contentful, parsedValues)
      //         break;
    }

    // Show an error
    console.error('@@/ERROR: No action chosen. Please try again')
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
 * @property {string} CMS_RELEASE_DB - The SQLite database file for the sync.
 * @property {string} CMS_RELEASE_CONFIG - The JS config file for the sync.
 * @property {string} CMS_RELEASE_ENVIRONMENT_MAIN - The main Contentful environment, usually 'master'.
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
 * @property {string} CMS_RELEASE_DB - The SQLite database file for the sync.
 * @property {string} CMS_RELEASE_CONFIG - The JS config file for the sync.
 * @property {string} CMS_RELEASE_ENVIRONMENT_MAIN - The main Contentful environment, usually 'master'.
 * @property {string} CMS_RELEASE_ENVIRONMENT_PROTECTED - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} CMS_RELEASE_ENVIRONMENT_REGEX - A regular expression for the release branches, usually 'release-x.y.z'.
 * @returns {Promise<object>} The initial settings.
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentId - The to/from environmentId.
 * @property {string} mainEnvironment - The main Contentful environment, usually 'master'.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @throws {Error} If '--environment-id', '--form' or '--to' are not provided or if '--management-token' or '--mt' are duplicated.
 */
async function parseArguments(rootFolder, envValues) {
  const minimist = (await import('minimist')).default
  const parsedArgs = minimist(process.argv.slice(2))

  const {
    'space-id': spaceId = envValues?.CMS_SPACE_ID ?? PLACEHOLDER_SPACE_ID,
    'management-token': managementToken = parsedArgs['mt'] ??
      envValues?.CMS_MANAGEMENT_TOKEN ??
      PLACEHOLDER_MANAGEMENT_TOKEN,
    'sync-db': syncPath = envValues?.CMS_RELEASE_DB ?? RELEASE_DB,
    'config-file': configPath = envValues?.CMS_RELEASE_CONFIG ?? RELEASE_CONFIG,
    'main-environment':
      mainEnvironment = envValues?.CMS_RELEASE_ENVIRONMENT_MAIN ??
        RELEASE_ENVIRONMENT_MAIN,
    'protected-environments':
      protectedEnvironments = envValues?.CMS_RELEASE_ENVIRONMENT_PROTECTED ??
        RELEASE_ENVIRONMENT_PROTECTED,
    'release-regex':
      releaseRegularExpression = envValues?.CMS_RELEASE_ENVIRONMENT_REGEX ??
        RELEASE_ENVIRONMENT_REGEX
  } = parsedArgs

  let chosenAction = 0 // no action
  if (parsedArgs.hasOwnProperty('duplicate-master')) {
    chosenAction = 1
  }
  if (parsedArgs.hasOwnProperty('sync-scheduled-actions')) {
    chosenAction = 2
  }
  if (parsedArgs.hasOwnProperty('link-master')) {
    chosenAction = 3
  }
  if (parsedArgs.hasOwnProperty('sync-current-master')) {
    chosenAction = 4
  }

  const environmentId = await getEnvFromArgs(parsedArgs, chosenAction)

  return {
    managementToken,
    spaceId,
    chosenAction,
    pruneOldReleases: parsedArgs.hasOwnProperty('prune-old-releases'),
    environmentId,
    syncPath,
    configPath,
    mainEnvironment,
    protectedEnvironments,
    releaseRegularExpression
  }
}

/**
 * This function checks arguments and extract the environmentId
 *
 * @param {Object} parsedArgs - The object that contains the parsed command line arguments.
 * @property {string} from - The FROM environment
 * @property {string} environment-id - The FROM environment
 * @property {string} mt - The Contentful Management Token
 * @property {string} management-token - The Contentful Management Token
 * @param {integer} chosenAction - The chosen Action
 * @returns {Promise<string>} Environment for which the action needs to be made
 *
 * @throws {Error} If both 'from/to' and 'environment-id' options are specified or if neither is specified.
 * @throws {Error} If both 'management-token' and 'mt' options are specified.
 */
async function getEnvFromArgs(parsedArgs, chosenAction) {
  if (
    !(
      (Boolean(parsedArgs.from) || Boolean(parsedArgs.to)) ^
      Boolean(parsedArgs['environment-id'])
    )
  ) {
    console.error(
      "@@/ERROR: Only one of the two options '--environment-id' or '--from/--to' should be specified"
    )
    process.exit(1)
  }

  if (Boolean(parsedArgs['management-token']) && Boolean(parsedArgs.mt)) {
    console.error(
      "@@/ERROR: Only one of the two options '--management-token' or '--mt' can be specified"
    )
    process.exit(1)
  }

  if (chosenAction > 1) {
    return parsedArgs.from ?? parsedArgs['environment-id']
  } else {
    return parsedArgs.to ?? parsedArgs['environment-id']
  }
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
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentId - The to/from environmentId.
 * @property {string} mainEnvironment - The main Contentful environment, usually 'master'.
 * @property {string} protectedEnvironments - A list of protected environment, usually 'dev,staging,master'.
 * @property {string} releaseRegularExpression - A regular expression for the release branches, usually 'release-x.y.z'.
 *
 * @returns {Promise<void>}
 */
async function duplicateMaster(
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

  const duplicateEnvironment = await contentfulLib.duplicateEnvironment(
    spaceSingleton,
    parsedArguments?.mainEnvironment,
    parsedArguments?.environmentId,
    3
  )

  if (duplicateEnvironment) {
    // Enable the CDA key for the new release environment
    // The CDA key should be named 'master' as the environment
    const creationKeyResult = await contentfulLib.enableCdaKey(
      spaceSingleton,
      parsedArguments?.mainEnvironment,
      parsedArguments?.environmentId
    )

    console.log(
      "##/INFO: CDA '" +
        parsedArguments?.mainEnvironment +
        "' Key " +
        (creationKeyResult ? '' : 'NOT ') +
        'assigned to environment ' +
        parsedArguments?.environmentId
    )

    // Wait few seconds before checking if environment is available. It might not be
    let timerId = setInterval(() => {
      duplicateEnvironment
        .getEntries({ limit: 1 })
        .then(entries => {
          console.log(
            '##/INFO: ' +
              parsedArguments?.environmentId +
              ' successfully duplicated from ' +
              parsedArguments?.mainEnvironment
          )

          // Success, therefore clear the interval
          clearInterval(timerId)
        })
        .catch(e => {
          console.log(
            '%%/DEBUG: Waiting to retrieve the newly created environment ' +
              parsedArguments?.environmentId
          )
        })
    }, 1000)
  }

  console.error(
    `@@/ERROR: There was an error duplicating the environment ${parsedArguments?.environmentId}`
  )
  console.error(
    '@@/ERROR: Please check the input parameters and investigate the previous error messages for more details'
  )
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
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentId - The to/from environmentId.
 * @property {string} mainEnvironment - The main Contentful environment, usually 'master'.
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

/**
 * Check if the destination environment exists before running the migration(s)
 *
 * @param {import("contentful-management/dist/typings/contentful-management").ContentfulManagement} contentfulManagement - The Contentful Management client.
 * @param {import("contentful-lib-helpers").} contentfulLib - The Contentful Libraries.
 * @param {Object} parsedArguments
 * @property {string} managementToken - The CMS Management Token.
 * @property {string} spaceId - The CMS Space ID.
 * @property {string} chosenAction - The Chosen action (sync, duplicate, etc.).
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentId - The to/from environmentId.
 * @property {string} mainEnvironment - The main Contentful environment, usually 'master'.
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
 * @property {boolean} pruneOldReleases - If it should prune old releases when linking the new master env.
 * @property {string} syncPath - The SQLite database file for the sync.
 * @property {string} configPath - The JS config file for the sync.
 * @property {String} environmentId - The to/from environmentId.
 * @property {string} mainEnvironment - The main Contentful environment, usually 'master'.
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
  const excludedEnvironments = parsedValues.protectedEnvironments.split(',')
  if (
    parsedValues.environmentId === '' ||
    excludedEnvironments.includes(parsedValues.environmentId)
  ) {
    console.error(
      '@@/ERROR: The destination environment is either empty or reserved!'
    )
    process.exit(1)
  }

  const regex = new RegExp(parsedValues.releaseRegularExpression, 'g')
  if (!parsedValues.environmentId.match(regex)) {
    console.error(
      '@@/ERROR: The destination environment should be following the proper naming convention'
    )
    process.exit(1)
  }

  // Add Check 'master' environment exists
  if (
    (await contentfulLib.getEnvironment(
      contentfulManagement,
      parsedValues.managementToken,
      parsedValues.spaceId,
      parsedValues.mainEnvironment
    )) === null
  ) {
    console.error('@@/ERROR: Master/Main environment does not exist!')
    process.exit(1)
  }
}