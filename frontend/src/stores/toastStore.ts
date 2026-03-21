import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (type: Toast['type'], message: string, duration?: number) => void
  removeToast: (id: string) => void
}

const MAX_TOASTS = 3

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => {
      const next = [...state.toasts, { id, type, message, duration }]
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next }
    })
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
