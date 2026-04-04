import express from 'express'

const app = express()
app.use(express.json())

app.get('/', (_, res) => res.send('Hello from app'))

export default app
