import { Router } from 'express'
import * as c from '../controllers/customerAuthController'

export const customerAuthRoutes = Router()

customerAuthRoutes.post('/register', c.register)
customerAuthRoutes.post('/login', c.login)
customerAuthRoutes.get('/me', c.me)
