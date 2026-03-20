import express from 'express'

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.send('Hello from app'))

export default app
