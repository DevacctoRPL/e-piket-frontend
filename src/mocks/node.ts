/** Server MSW untuk Vitest (jsdom). */
import { setupServer } from 'msw/node'
import { registerSeeder, resetDb } from './db'
import { handlers } from './handlers'
import { seed } from './seed'

registerSeeder(seed)

export const server = setupServer(...handlers)
export { resetDb }
