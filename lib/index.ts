import {readFileSync} from 'fs'
import * as path from 'path'

import {JSHandle, Page} from 'playwright'
import waitForExpect from 'wait-for-expect'

import {queryNames} from './common'
import {ConfigurationOptions, ElementHandle, Queries, ScopedQueries} from './typedefs'

const domLibraryAsString = readFileSync(
  path.join(__dirname, '../dom-testing-library.js'),
  'utf8',
).replace(/process.env/g, '{}')

/* istanbul ignore next */
function convertProxyToRegExp(o: any, depth: number): any {
  if (typeof o !== 'object' || !o || depth > 2) return o
  if (!o.__regex || typeof o.__flags !== 'string') {
    const copy = {...o}
    for (const key of Object.keys(copy)) {
      copy[key] = convertProxyToRegExp(copy[key], depth + 1)
    }
    return copy
  }

  return new RegExp(o.__regex, o.__flags)
}

/* istanbul ignore next */
function mapArgument(o: any): any {
  return convertProxyToRegExp(o, 0)
}

function convertRegExpToProxy(o: any, depth: number): any {
  if (typeof o !== 'object' || !o || depth > 2) return o
  if (!(o instanceof RegExp)) {
    const copy = {...o}
    for (const key of Object.keys(copy)) {
      copy[key] = convertRegExpToProxy(copy[key], depth + 1)
    }
    return copy
  }

  return {__regex: o.source, __flags: o.flags}
}

const delegateFnBodyToExecuteInPageInitial = `
  ${domLibraryAsString};
  ${convertProxyToRegExp.toString()};

  const mappedArgs = args.map(${mapArgument.toString()});
  const moduleWithFns = fnName in __dom_testing_library__ ?
    __dom_testing_library__ :
    __dom_testing_library__.__moduleExports;
  return moduleWithFns[fnName](container, ...mappedArgs);
`

let delegateFnBodyToExecuteInPage = delegateFnBodyToExecuteInPageInitial

type DOMReturnType = ElementHandle | ElementHandle[] | null

type ContextFn = (...args: any[]) => ElementHandle

async function createElementHandle(handle: JSHandle): Promise<ElementHandle | null> {
  const element = handle.asElement()
  if (element) return element
  await handle.dispose()
  return null
}

async function createElementHandleArray(handle: JSHandle): Promise<ElementHandle[]> {
  const lengthHandle = await handle.getProperty('length')
  const length = (await lengthHandle.jsonValue()) as number

  const elements: ElementHandle[] = []

  /* eslint-disable no-plusplus, no-await-in-loop */
  for (let i = 0; i < length; i++) {
    const jsElement = await handle.getProperty(i.toString())
    const element = await createElementHandle(jsElement)
    if (element) elements.push(element)
  }
  /* eslint-enable no-plusplus, no-await-in-loop */

  return elements
}

async function covertToElementHandle(handle: JSHandle, asArray: boolean): Promise<DOMReturnType> {
  return asArray ? createElementHandleArray(handle) : createElementHandle(handle)
}

function processNodeText(handles: HandleSet): Promise<string> {
  return handles.containerHandle.evaluate(handles.evaluateFn, ['getNodeText'])
}

async function processQuery(handles: HandleSet): Promise<DOMReturnType> {
  const {containerHandle, evaluateFn, fnName, argsToForward} = handles

  try {
    const handle = await containerHandle.evaluateHandle(evaluateFn, [fnName, ...argsToForward])
    return await covertToElementHandle(handle, fnName.includes('All'))
  } catch (error) {
    if (error instanceof Error) {
      error.message = error.message
        .replace(/^.*(?=TestingLibraryElementError:)/, '')
        .replace('[fnName]', `[${fnName}]`)

      error.stack = error.stack?.replace('[fnName]', `[${fnName}]`)
    }

    throw error
  }
}

interface HandleSet {
  containerHandle: ElementHandle
  // FIXME: Playwright doesn't expose a type for this like Puppeteer does with
  // `EvaluateFn`. This *should* be something like the `PageFunction` type that
  // is unfortunately not exported from the Playwright modules.
  evaluateFn: any
  fnName: string
  argsToForward: any[]
}

function createDelegateFor<T = DOMReturnType>(
  fnName: keyof Queries,
  contextFn?: ContextFn,
  processHandleFn?: (handles: HandleSet) => Promise<T>,
): (...args: any[]) => Promise<T> {
  // @ts-ignore
  // eslint-disable-next-line no-param-reassign
  processHandleFn = processHandleFn || processQuery

  return async function delegate(...args: any[]): Promise<T> {
    // @ts-ignore
    const containerHandle: ElementHandle = contextFn ? contextFn.apply(this, args) : this

    // @ts-ignore
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
    const evaluateFn = new Function('container, [fnName, ...args]', delegateFnBodyToExecuteInPage)

    let argsToForward = args
    // Remove the container from the argsToForward since it's always the first argument
    if (containerHandle === args[0]) {
      argsToForward = argsToForward.slice(1)
    }

    // Convert RegExp to a special format since they don't serialize well
    argsToForward = argsToForward.map(convertRegExpToProxy)

    return processHandleFn!({fnName, containerHandle, evaluateFn, argsToForward})
  }
}

export async function getDocument(_page?: Page): Promise<ElementHandle> {
  // @ts-ignore
  const page: Page = _page || this
  const documentHandle = await page.mainFrame().evaluateHandle('document')
  const document = documentHandle.asElement()
  if (!document) throw new Error('Could not find document')
  return document
}

type WaitForCallback = Parameters<typeof waitForExpect>[0]

export function wait(
  callback: WaitForCallback,
  {timeout = 4500, interval = 50}: {timeout?: number; interval?: number} = {},
): Promise<{}> {
  return waitForExpect(callback, timeout, interval)
}

export const waitFor = wait

export function configure(options: Partial<ConfigurationOptions>): void {
  if (!options) {
    return
  }

  const {testIdAttribute} = options

  if (testIdAttribute) {
    delegateFnBodyToExecuteInPage = delegateFnBodyToExecuteInPageInitial.replace(
      /testIdAttribute: (['|"])data-testid(['|"])/g,
      `testIdAttribute: $1${testIdAttribute}$2`,
    )
  }
}

export function getQueriesForElement<T>(
  object: T,
  contextFn?: ContextFn,
): T & Queries & ScopedQueries {
  const o = object as any
  // eslint-disable-next-line no-param-reassign
  if (!contextFn) contextFn = () => o

  queryNames.forEach(functionName => {
    o[functionName] = createDelegateFor(functionName, contextFn)
  })

  o.getQueriesForElement = () => getQueriesForElement(o, () => o)
  o.getNodeText = createDelegateFor<string>('getNodeText', contextFn, processNodeText)

  return o
}

export const within = getQueriesForElement

// @ts-ignore
export const queries: Queries = {}
getQueriesForElement(queries, el => el)
