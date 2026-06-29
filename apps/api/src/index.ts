import 'dotenv/config'
import { createServer } from './server.js'
import { config } from './config.js'

const server = createServer()

server.listen({ host: config.host, port: config.port }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
