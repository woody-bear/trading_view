# Contract: BUY 신호 알림 API

## 알림 이력 조회

### `GET /api/alerts/history`

**Query Params**: `type` (optional, "scheduled_buy" | "realtime", default: all), `limit` (default: 20)

**Response**:
```json
{
  "alerts": [
    {
      "id": 1,
      "sent_at": "2026-03-21T10:30:01",
      "alert_type": "scheduled_buy",
      "success": true,
      "error_message": null,
      "message": "📊 국내주식 BUY 신호 (3/21 10:30)\n\n1. 삼성전자...",
      "symbol_count": 3
    }
  ]
}
```

## 수동 알림 전송

### `POST /api/alerts/buy-signal/test`

**Response (성공)**:
```json
{
  "status": "sent",
  "symbol_count": 3,
  "message": "BUY 신호 3종목 전송 완료"
}
```

**Response (텔레그램 미설정)**:
```json
{
  "status": "error",
  "message": "텔레그램 설정을 먼저 완료해주세요"
}
```

## 텔레그램 메시지 포맷

```
📊 국내주식 BUY 신호 ({월}/{일} {시}:{분})

1. {종목명} ({심볼})
   💰 {현재가}원 ({등락률}%)
   🔥 {신호강도} ({신뢰도}점) | 신호일: {월}/{일}
   📈 상세보기 → {BASE_URL}/{심볼}

총 {N}종목 | 추세추종 연구소
```

**신호 없을 때**:
```
📊 국내주식 BUY 신호 ({월}/{일} {시}:{분})

현재 BUY 신호 종목이 없습니다.

추세추종 연구소
```
