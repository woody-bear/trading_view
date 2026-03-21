# Contract: Toast Store API

## Zustand Store — `useToastStore`

### State
```typescript
interface ToastState {
  toasts: Toast[]
  addToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration: number  // default: 3000ms
}
```

### Usage
```typescript
const { addToast } = useToastStore()

// 성공
addToast('success', '관심종목에 추가되었습니다')

// 실패
addToast('error', '설정 변경에 실패했습니다')

// 정보
addToast('info', '이미 등록된 종목입니다')
```

### Behavior
- 최대 동시 표시: 3개 (초과 시 가장 오래된 것 제거)
- 자동 소멸: duration ms 후 자동 제거
- 위치: 화면 하단 중앙 (모바일 탭바 위)
