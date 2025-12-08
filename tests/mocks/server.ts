import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server for API mocking in tests
export const server = setupServer(...handlers)