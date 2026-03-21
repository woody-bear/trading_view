# Contract: Chart Error Boundary & States

## ChartErrorBoundary Component

### Props
```typescript
interface ChartErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onReset?: () => void  // 재시도 시 호출
}
```

### Fallback UI
- 차트 영역과 동일한 높이 (670px = 450+110+110)
- 중앙 아이콘 + "차트를 표시할 수 없습니다" 메시지
- "새로고침" 버튼 → onReset 호출 → ErrorBoundary 리셋

## ChartEmptyState Component

### Props
```typescript
interface ChartEmptyStateProps {
  status: 'empty' | 'timeout' | 'error'
  message?: string
  onRetry?: () => void
}
```

### Rendering
| Status | Message | Action |
|--------|---------|--------|
| empty | 차트 데이터가 없습니다 | - |
| timeout | 데이터 로딩 시간이 초과되었습니다 | 재시도 버튼 |
| error | 차트 데이터를 불러올 수 없습니다 | 재시도 버튼 |

## ChartSkeleton Component

### Props
```typescript
interface ChartSkeletonProps {
  className?: string
}
```

### Rendering
- 메인 차트 영역: h-[450px] bg-gray-800 animate-pulse rounded
- RSI 영역: h-[110px] bg-gray-800 animate-pulse rounded
- MACD 영역: h-[110px] bg-gray-800 animate-pulse rounded
- 각 영역 사이 gap-1
