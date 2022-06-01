import type {Config, ConfigureLocator, ConfigurePage} from '../types'

import {buildTestingLibraryScript} from './helpers'

const defaultConfiguration: Config = {testIdAttribute: 'data-testid'}

// eslint-disable-next-line import/no-mutable-exports
let configuration: Config = {...defaultConfiguration}

const mergeConfiguration: ConfigureLocator = configDelta =>
  typeof configDelta === 'function'
    ? {
        ...configuration,
        ...configDelta(configuration),
      }
    : {...configuration, ...configDelta}

const configure: ConfigureLocator = configDelta => {
  configuration = mergeConfiguration(configDelta)

  return configuration
}

const configurePage: ConfigurePage =
  configDelta =>
  async ({page}) => {
    await page.evaluate(
      await buildTestingLibraryScript({
        configuration: mergeConfiguration(configDelta),
      }),
    )
  }

export {configuration, configure, configurePage}
