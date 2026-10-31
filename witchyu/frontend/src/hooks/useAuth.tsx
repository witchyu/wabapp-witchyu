import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../services/api'
import {
  customerAuthApi,
  customerAuthStorage,
  type CustomerUser,
} from '../services/customerAuth'
import { notifyCustomerAuthChanged } from '../services/customerToken'

interface AuthContextValue {
  user: CustomerUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    customer: {
      nickname: string
      fullName: string
      age: number
      relationship: string
    },
  ) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(() => customerAuthStorage.getUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const restore = async () => {
      const token = customerAuthStorage.getToken()
      if (!token) {
        if (active) setReady(true)
        return
      }

      try {
        const result = await customerAuthApi.me()
        if (active) {
          customerAuthStorage.save({
            token,
            expiresAt: 0,
            user: result.user,
          })
          setUser(result.user)
          notifyCustomerAuthChanged()
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          customerAuthStorage.clear()
          if (active) setUser(null)
        }
      } finally {
        if (active) setReady(true)
      }
    }

    void restore()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await customerAuthApi.login(email, password)
    customerAuthStorage.save(result)
    setUser(result.user)
    notifyCustomerAuthChanged()
  }, [])

  const register = useCallback(async (
    email: string,
    password: string,
    customer: {
      nickname: string
      fullName: string
      age: number
      relationship: string
    },
  ) => {
    const result = await customerAuthApi.register(email, password, customer)
    customerAuthStorage.save(result)
    setUser(result.user)
    notifyCustomerAuthChanged()
  }, [])

  const logout = useCallback(() => {
    customerAuthStorage.clear()
    setUser(null)
    notifyCustomerAuthChanged()
  }, [])

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
