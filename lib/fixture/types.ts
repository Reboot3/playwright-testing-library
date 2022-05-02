import {Locator} from '@playwright/test'
import type * as TestingLibraryDom from '@testing-library/dom'
import {queries} from '@testing-library/dom'

import {reviver} from './helpers'

/**
 * This type was copied across from Playwright
 *
 * @see {@link https://github.com/microsoft/playwright/blob/82ff85b106e31ffd7b3702aef260c9c460cfb10c/packages/playwright-core/src/client/types.ts#L108-L117}
 */
export type SelectorEngine = {
  /**
   * Returns the first element matching given selector in the root's subtree.
   */
  query(root: HTMLElement, selector: string): HTMLElement | null
  /**
   * Returns all elements matching given selector in the root's subtree.
   */
  queryAll(root: HTMLElement, selector: string): HTMLElement[]
}

type Queries = typeof queries

type StripNever<T> = {[P in keyof T as T[P] extends never ? never : P]: T[P]}
type ConvertQuery<Query extends Queries[keyof Queries]> = Query extends (
  el: HTMLElement,
  ...rest: infer Rest
) => HTMLElement | (HTMLElement[] | null) | (HTMLElement | null)
  ? (...args: Rest) => Locator
  : never

type KebabCase<S> = S extends `${infer C}${infer T}`
  ? T extends Uncapitalize<T>
    ? `${Uncapitalize<C>}${KebabCase<T>}`
    : `${Uncapitalize<C>}-${KebabCase<T>}`
  : S

export type LocatorQueries = StripNever<{[K in keyof Queries]: ConvertQuery<Queries[K]>}>

export type Query = keyof Queries

export type AllQuery = Extract<Query, `${string}All${string}`>
export type FindQuery = Extract<Query, `find${string}`>
export type SupportedQuery = Exclude<Query, FindQuery>

export type Selector = KebabCase<SupportedQuery>

declare global {
  interface Window {
    TestingLibraryDom: typeof TestingLibraryDom
    __testingLibraryReviver: typeof reviver
  }
}
