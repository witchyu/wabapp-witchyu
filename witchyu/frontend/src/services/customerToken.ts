const TOKEN_KEY = 'witchyu.customerToken'

export function getCustomerToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function notifyCustomerAuthChanged(): void {
  window.dispatchEvent(new Event('witchyu:auth-changed'))
}
