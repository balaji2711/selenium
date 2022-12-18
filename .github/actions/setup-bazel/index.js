const fs = require('fs')
const core = require('@actions/core')
const cache = require('@actions/cache')
const glob = require('@actions/glob')
const config = require('./config')

async function run () {
  try {
    await setupBazel()
  } catch (error) {
    core.setFailed(error.stack)
  }
}

async function setupBazel () {
  console.log('Setting up Bazel with:')
  console.log(config)

  await optimizeCacheOnWindows()
  await setupBazelrc()

  if (core.getBooleanInput('bazelisk-cache')) {
    await restoreCache(config.bazeliskCache)
  }

  if (core.getBooleanInput('repository-cache')) {
    await restoreCache(config.repositoryCache)
  }

  for (const name in config.externalCache) {
    await restoreCache(config.externalCache[name])
  }
}

async function optimizeCacheOnWindows () {
  if (config.platform !== 'win32') {
    return
  }

  // Bazel relies heavily on symlinks.
  core.exportVariable('MSYS', 'winsymlinks:native')
}

async function setupBazelrc () {
  fs.writeFileSync(
    config.paths.bazelrc,
    `startup --output_base=${config.paths.bazelOutputBase}\n`
  )

  for (const line of config.bazelrc) {
    fs.appendFileSync(config.paths.bazelrc, `${line}\n`)
  }
}

async function restoreCache (cacheConfig) {
  const hash = await glob.hashFiles(cacheConfig.files.join('\n'))
  const name = cacheConfig.name
  const paths = cacheConfig.paths
  const restoreKey = `${config.baseCacheKey}-${name}-`
  const key = `${restoreKey}-${hash}`

  console.log(`Attempting to restore ${name} cache from ${key}`)

  const restoredKey = await cache.restoreCache(paths, key, [restoreKey])
  if (restoredKey) {
    console.log(`Successfully restored cache from ${restoredKey}`)
    if (restoredKey === key) {
      return
    }
  } else {
    console.log(`Failed to restore ${name} cache`)
  }

  core.saveState(`${name}-cache-key`, key)
}

run()
