import { api } from './api'

const TOKEN_KEY = 'witchyu.customerToken'
const USER_KEY = 'witchyu.customerUser'

export interface CustomerUser {
  id: string
  clientId: string
  email: string
  nickname: string
  fullName: string
  age: number
  relationship: string
}

export interface AuthResult {
  token: string
  expiresAt: number
  user: CustomerUser
}

export const customerAuthStorage = {
  getToken(): string {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? ''
    } catch {
      return ''
    }
  },

  getUser(): CustomerUser | null {
    try {
      const value = localStorage.getItem(USER_KEY)
      return value ? JSON.parse(value) as CustomerUser : null
    } catch {
      return null
    }
  },

  save(result: AuthResult) {
    localStorage.setItem(TOKEN_KEY, result.token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export const customerAuthApi = {
  login(email: string, password: string) {
    return api.post<AuthResult>('/auth/login', { email, password })
  },

  register(
    email: string,
    password: string,
    customer?: {
      nickname: string
      fullName: string
      age: number
      relationship: string
    },
  ) {
    return api.post<AuthResult>('/auth/register', {
      email,
      password,
      ...(customer ? { customer } : {}),
    })
  },

  me() {
    return api.get<{ user: CustomerUser }>('/auth/me', {
      Authorization: `Bearer ${customerAuthStorage.getToken()}`,
    })
  },
}
