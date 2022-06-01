import {Fixtures} from '@playwright/test'

import {configure as elementHandleConfigure} from '..'

import type {Queries as ElementHandleQueries} from './element-handle'
import {queriesFixture as elementHandleQueriesFixture} from './element-handle'
import {
  installTestingLibraryFixture,
  configure as locatorConfigure,
  queriesFixture as locatorQueriesFixture,
  registerSelectorsFixture,
  within,
} from './locator'
import type {Queries as LocatorQueries} from './locator'
import type {Configure} from './types'

const elementHandleFixtures: Fixtures = {queries: elementHandleQueriesFixture}
const locatorFixtures: Fixtures = {
  queries: locatorQueriesFixture,
  registerSelectors: registerSelectorsFixture,
  installTestingLibrary: installTestingLibraryFixture,
}

interface ElementHandleFixtures {
  queries: ElementHandleQueries
}

interface LocatorFixtures {
  queries: LocatorQueries
  registerSelectors: void
  installTestingLibrary: void
}

export type {ElementHandleFixtures as TestingLibraryFixtures}
export {elementHandleQueriesFixture as fixture}
export {elementHandleFixtures as fixtures}

export type {LocatorFixtures}
export {locatorQueriesFixture}
export {locatorFixtures, within}
export {configurePage} from './locator'

export const configure: Configure = configDelta => {
  const configuration = locatorConfigure(configDelta)

  elementHandleConfigure(configuration)
}
