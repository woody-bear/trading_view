import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../stores/toastStore'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { setAuthError } = useAuthStore()
  const { addToast } = useToastStore()

  useEffect(() => {
    // Check for error params in URL (Supabase returns error_description on failure)
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
    const errorDesc = params.get('error_description') ?? hashParams.get('error_description')
    const error = params.get('error') ?? hashParams.get('error')

    if (error || errorDesc) {
      const msg = errorDesc ?? error ?? 'Google 로그인 실패'
      setAuthError(msg)
      addToast('error', msg)
      navigate('/', { replace: true })
      return
    }

    supabase.auth.getSession().then(({ error: sessionError }) => {
      if (sessionError) {
        const msg = `로그인 처리 실패: ${sessionError.message}`
        setAuthError(msg)
        addToast('error', msg)
      }
      const returnUrl = localStorage.getItem('auth_return_url')
      localStorage.removeItem('auth_return_url')
      navigate(returnUrl ?? '/', { replace: true })
    })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">로그인 처리 중...</p>
      </div>
    </div>
  )
}
