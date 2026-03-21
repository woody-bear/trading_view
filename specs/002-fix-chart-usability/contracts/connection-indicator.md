# Contract: Connection Status Indicator

## useRealtimePrice Hook (변경)

### 기존 반환값
```typescript
{ livePrice: number | null, connected: boolean }
```

### 변경 반환값
```typescript
{
  livePrice: number | null
  connected: boolean           // 하위 호환 (status === 'connected')
  connectionStatus: ConnectionStatus
}

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'
```

## ConnectionIndicator Component

### Props
```typescript
interface ConnectionIndicatorProps {
  status: ConnectionStatus
  onReconnect: () => void  // 수동 재연결 콜백
}
```

### Rendering
| Status | Color | Text | Button |
|--------|-------|------|--------|
| connected | green-500 | 실시간 | - |
| reconnecting | yellow-500 | 재연결 중... | - |
| disconnected | red-500 | 연결 끊김 | 재연결 |
