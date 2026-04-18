# BUY 스캔 대상 종목 리스트

> 업데이트: 2026-04-12
> 출처: KRX 공식 데이터, RISE ETF, KODEX ETF, Investing.com, Wikipedia 등 (웹 조회 기준)
> 서비스: https://www.asst.kr/buy-list

---

## 현황판 (scan_symbols_list.py 기준 / 2026-04-12)

| 항목 | 수치 |
|------|------|
| **총 스캔 종목** | **1,198** |
| 국내 (9:30~15:30) | 470 |
| 미국+암호화폐 (19:50/03:50) | 728 (미국 718 + 암호화폐 10) |

### 국내 세부

| 분류 | 종목 수 | 비고 |
|------|---------|------|
| 코스피200 | 198 | KRX 지수 기준 (중복 제거 후) |
| 코스닥150 | 148 | KRX 지수 기준 (중복 제거 후) |
| KRX 섹터 | 5 | 반도체/2차전지 단독 종목 |
| 국내 ETF | 119 | KODEX/TIGER/KBSTAR/RISE/ACE/HANARO/SOL (32개 무효 코드 제거, 7개 올바른 코드로 대체) |
| **합계** | **470** | |

### 미국 세부

| 분류 | 종목 수 | 비고 |
|------|---------|------|
| S&P 500 | 498 | NYSE/NASDAQ 대형주 (다우존스30 완전 포함) |
| 나스닥100 단독 | 14 | S&P500 미포함 종목 |
| 다우존스30 | 0 추가 | S&P500과 100% 중복 — 참조용 세트만 유지 |
| 미국 ETF | 206 | 지수/채권/원자재/섹터/레버리지/해외/테마 |
| **미국 합계** | **718** | |

### 암호화폐

| 종목 | 심볼 |
|------|------|
| Bitcoin | BTC-USD |
| Ethereum | ETH-USD |
| Solana | SOL-USD |
| BNB | BNB-USD |
| Ripple | XRP-USD |
| Cardano | ADA-USD |
| Dogecoin | DOGE-USD |
| Avalanche | AVAX-USD |
| Chainlink | LINK-USD |
| Polkadot | DOT-USD |

### 문서 vs 서비스 일치 현황

| 항목 | 문서 | 서비스(코드) | 상태 |
|------|------|------------|------|
| 코스피200 | 200종목 | 198종목 | ⚠️ 2종목 차이 (중복제거/상장폐지) |
| 코스닥150 | 150종목 | 148종목 | ⚠️ 2종목 차이 (중복제거) |
| KRX 섹터 | 60종목(문서) | 5종목(코드) | ⚠️ 문서는 반도체+2차전지 전체, 코드는 단독만 |
| 국내 ETF | 188종목(문서) | 151종목(코드) | ⚠️ 문서 > 코드 (일부 미추가) |
| S&P500 | 504종목 | 498종목 | ⚠️ 6종목 차이 (상장폐지/합병) |
| 나스닥100 | 101종목(문서) | 14종목(코드) | ⚠️ 코드는 S&P500 미포함 단독만 |
| 다우존스30 | 30종목 | 0 추가 (SP500에 포함) | ✅ DJIA30_TICKERS 참조 세트 유지 |
| Russell1000 | 제외 | 제외 | ✅ 스캔 대상에서 제거 (2026-04-12) |
| 미국 ETF | 218종목(문서) | 206종목(코드) | ⚠️ 문서 > 코드 (일부 미추가) |
| 암호화폐 | 부분 언급 | 10종목 | ✅ 코드 기준 확정 |

> ※ 2026-04-12 변경: Russell1000 단독 323종목 제거 → 다우존스30 참조 세트(DJIA30_TICKERS) 추가 (실질 스캔 대상 변화 없음, SP500에 포함).
> 서버 재시작 후 `refresh_stock_master()` 실행 시 코드 기준 수치(총 ~1,198)로 업데이트됨.

---

## 국내

### 코스피200 (200종목)

> 출처: RISE 200 ETF 구성종목 (2026-03-30 기준)

| 종목코드 | 종목명 |
|----------|--------|
| 005930 | 삼성전자 |
| 000660 | SK하이닉스 |
| 005380 | 현대차 |
| 105560 | KB금융 |
| 402340 | SK스퀘어 |
| 012450 | 한화에어로스페이스 |
| 034020 | 두산에너빌리티 |
| 055550 | 신한지주 |
| 000270 | 기아 |
| 068270 | 셀트리온 |
| 035420 | NAVER |
| 086790 | 하나금융지주 |
| 028260 | 삼성물산 |
| 006400 | 삼성SDI |
| 012330 | 현대모비스 |
| 009150 | 삼성전기 |
| 005490 | POSCO홀딩스 |
| 316140 | 우리금융지주 |
| 373220 | LG에너지솔루션 |
| 267260 | HD현대일렉트릭 |
| 032830 | 삼성생명 |
| 006800 | 미래에셋증권 |
| 009540 | HD한국조선해양 |
| 010140 | 삼성중공업 |
| 035720 | 카카오 |
| 042660 | 한화오션 |
| 329180 | HD현대중공업 |
| 207940 | 삼성바이오로직스 |
| 051910 | LG화학 |
| 033780 | KT&G |
| 000810 | 삼성화재 |
| 030200 | KT |
| 015760 | 한국전력 |
| 064350 | 현대로템 |
| 047810 | 한국항공우주 |
| 010120 | LS ELECTRIC |
| 066570 | LG전자 |
| 017670 | SK텔레콤 |
| 034730 | SK |
| 298040 | 효성중공업 |
| 267250 | HD현대 |
| 042700 | 한미반도체 |
| 000720 | 현대건설 |
| 010130 | 고려아연 |
| 079550 | LIG넥스원 |
| 138040 | 메리츠금융지주 |
| 071050 | 한국금융지주 |
| 096770 | SK이노베이션 |
| 272210 | 한화시스템 |
| 323410 | 카카오뱅크 |
| 000150 | 두산 |
| 086280 | 현대글로비스 |
| 278470 | 에이피알 |
| 003550 | LG |
| 003670 | 포스코퓨처엠 |
| 259960 | 크래프톤 |
| 005830 | DB손해보험 |
| 352820 | 하이브 |
| 003490 | 대한항공 |
| 000100 | 유한양행 |
| 011200 | HMM |
| 039490 | 키움증권 |
| 024110 | 기업은행 |
| 018260 | 삼성에스디에스 |
| 016360 | 삼성증권 |
| 007660 | 이수페타시스 |
| 028050 | 삼성E&A |
| 180640 | 한진칼 |
| 175330 | JB금융지주 |
| 138930 | BNK금융지주 |
| 003230 | 삼양식품 |
| 005940 | NH투자증권 |
| 006260 | LS |
| 010950 | S-Oil |
| 011070 | LG이노텍 |
| 090430 | 아모레퍼시픽 |
| 032640 | LG유플러스 |
| 066970 | 엘앤에프 |
| 036570 | 엔씨소프트 |
| 021240 | 코웨이 |
| 009830 | 한화솔루션 |
| 161390 | 한국타이어앤테크놀로지 |
| 128940 | 한미약품 |
| 047040 | 대우건설 |
| 047050 | 포스코인터내셔널 |
| 034220 | LG디스플레이 |
| 000880 | 한화 |
| 001440 | 대한전선 |
| 241560 | 두산밥캣 |
| 271560 | 오리온 |
| 004020 | 현대제철 |
| 064400 | LG씨엔에스 |
| 052690 | 한전기술 |
| 078930 | GS |
| 001040 | CJ |
| 010060 | OCI홀딩스 |
| 326030 | SK바이오팜 |
| 443060 | HD현대마린솔루션 |
| 307950 | 현대오토에버 |
| 139130 | iM금융지주 |
| 014680 | 한솔케미칼 |
| 082740 | 한화엔진 |
| 051900 | LG생활건강 |
| 012750 | 에스원 |
| 017800 | 현대엘리베이터 |
| 035250 | 강원랜드 |
| 009420 | 한올바이오파마 |
| 004170 | 신세계 |
| 002380 | KCC |
| 375500 | DL이앤씨 |
| 450080 | 에코프로머티 |
| 457190 | 이수스페셜티케미컬 |
| 139480 | 이마트 |
| 097950 | CJ제일제당 |
| 111770 | 영원무역 |
| 001450 | 현대해상 |
| 011780 | 금호석유화학 |
| 011790 | SKC |
| 062040 | 산일전기 |
| 071970 | HD현대마린엔진 |
| 088350 | 한화생명 |
| 022100 | 포스코DX |
| 011170 | 롯데케미칼 |
| 006360 | GS건설 |
| 112610 | 씨에스윈드 |
| 103140 | 풍산 |
| 251270 | 넷마블 |
| 192820 | 코스맥스 |
| 204320 | HL만도 |
| 454910 | 두산로보틱스 |
| 377300 | 카카오페이 |
| 120110 | 코오롱인더 |
| 161890 | 한국콜마 |
| 011210 | 현대위아 |
| 008770 | 호텔신라 |
| 000120 | CJ대한통운 |
| 004370 | 농심 |
| 017960 | 한국카본 |
| 036460 | 한국가스공사 |
| 029780 | 삼성카드 |
| 030000 | 제일기획 |
| 081660 | 미스토홀딩스 |
| 051600 | 한전KPS |
| 069960 | 현대백화점 |
| 073240 | 금호타이어 |
| 028670 | 팬오션 |
| 018880 | 한온시스템 |
| 023530 | 롯데쇼핑 |
| 008930 | 한미사이언스 |
| 009970 | 영원무역홀딩스 |
| 282330 | BGF리테일 |
| 302440 | SK바이오사이언스 |
| 298020 | 효성티앤씨 |
| 383220 | F&F |
| 361610 | SK아이이테크놀로지 |
| 185750 | 종근당 |
| 007340 | DN오토모티브 |
| 007070 | GS리테일 |
| 006280 | 녹십자 |
| 005850 | 에스엘 |
| 004000 | 롯데정밀화학 |
| 004990 | 롯데지주 |
| 002790 | 아모레퍼시픽홀딩스 |
| 000210 | DL |
| 001430 | 세아베스틸지주 |
| 026960 | 동서 |
| 034230 | 파라다이스 |
| 069620 | 대웅제약 |
| 001800 | 오리온홀딩스 |
| 000240 | 한국앤컴퍼니 |
| 000080 | 하이트진로 |
| 003090 | 대웅 |
| 004490 | 세방전지 |
| 007310 | 오뚜기 |
| 006650 | 대한유화 |
| 192080 | 더블유게임즈 |
| 285130 | SK케미칼 |
| 298050 | HS효성첨단소재 |
| 300720 | 한일시멘트 |
| 280360 | 롯데웰푸드 |
| 137310 | 에스디바이오센서 |
| 093370 | 후성 |
| 114090 | GKL |
| 008730 | 율촌화학 |
| 005420 | 코스모화학 |
| 006040 | 동원산업 |
| 009240 | 한샘 |
| 005250 | 녹십자홀딩스 |
| 005300 | 롯데칠성 |
| 002840 | 미원상사 |
| 003030 | 세아제강지주 |
| 000670 | 영풍 |
| 002030 | 아세아 |
| 001680 | 대상 |
| 069260 | TKG휴켐스 |
| 071320 | 지역난방공사 |
| 014820 | 동원시스템즈 |
| 268280 | 미원에스씨 |

---

### 코스닥150 (150종목)

> 출처: RISE 코스닥150 ETF 구성종목 (2026-03-30 기준)

| 종목코드 | 종목명 |
|----------|--------|
| 000250 | 삼천당제약 |
| 196170 | 알테오젠 |
| 086520 | 에코프로 |
| 247540 | 에코프로비엠 |
| 298380 | 에이비엘바이오 |
| 087010 | 펩트론 |
| 028300 | HLB |
| 141080 | 리가켐바이오 |
| 058470 | 리노공업 |
| 277810 | 레인보우로보틱스 |
| 240810 | 원익IPS |
| 032820 | 우리기술 |
| 310210 | 보로노이 |
| 039030 | 이오테크닉스 |
| 226950 | 올릭스 |
| 263750 | 펄어비스 |
| 108490 | 로보티즈 |
| 095340 | ISC |
| 347850 | 디앤디파마텍 |
| 214450 | 파마리서치 |
| 036930 | 주성엔지니어링 |
| 403870 | HPSP |
| 237690 | 에스티팜 |
| 083650 | 비에이치아이 |
| 039200 | 오스코텍 |
| 035900 | JYP Ent. |
| 445680 | 큐리옥스바이오시스템즈 |
| 084370 | 유진테크 |
| 319660 | 피에스케이 |
| 357780 | 솔브레인 |
| 005290 | 동진쎄미켐 |
| 058610 | 에스피지 |
| 214370 | 케어젠 |
| 067310 | 하나마이크론 |
| 082270 | 젬백스 |
| 145020 | 휴젤 |
| 178320 | 서진시스템 |
| 098460 | 고영 |
| 218410 | RFHIC |
| 089030 | 테크윙 |
| 064760 | 티씨케이 |
| 078600 | 대주전자재료 |
| 101490 | 에스앤에스텍 |
| 222800 | 심텍 |
| 257720 | 실리콘투 |
| 085660 | 차바이오텍 |
| 048410 | 현대바이오 |
| 290650 | 엘앤씨바이오 |
| 131970 | 두산테스나 |
| 041510 | 에스엠 |
| 323280 | 태성 |
| 214150 | 클래시스 |
| 068760 | 셀트리온제약 |
| 080220 | 제주반도체 |
| 140860 | 파크시스템스 |
| 065350 | 신성델타테크 |
| 328130 | 루닛 |
| 466100 | 클로봇 |
| 189300 | 인텔리안테크 |
| 137400 | 피엔티 |
| 007390 | 네이처셀 |
| 122870 | 와이지엔터테인먼트 |
| 032500 | 케이엠더블유 |
| 195940 | HK이노엔 |
| 281740 | 레이크머티리얼즈 |
| 232140 | 와이씨 |
| 031980 | 피에스케이홀딩스 |
| 050890 | 쏠리드 |
| 417200 | LS머트리얼즈 |
| 096530 | 씨젠 |
| 095610 | 테스 |
| 035760 | CJ ENM |
| 358570 | 지아이이노베이션 |
| 213420 | 덕산네오룩스 |
| 183300 | 코미코 |
| 161580 | 필옵틱스 |
| 166090 | 하나머티리얼즈 |
| 222080 | 씨아이에스 |
| 003380 | 하림지주 |
| 121600 | 나노신소재 |
| 014620 | 성광벤드 |
| 086450 | 동국제약 |
| 131290 | 티에스이 |
| 388720 | 유일로보틱스 |
| 348210 | 넥스틴 |
| 036810 | 에프에스티 |
| 042000 | 카페24 |
| 086900 | 메디톡스 |
| 365340 | 성일하이텍 |
| 241710 | 코스메카코리아 |
| 253450 | 스튜디오드래곤 |
| 293490 | 카카오게임즈 |
| 067160 | SOOP |
| 074600 | 원익QnC |
| 056080 | 유진로봇 |
| 060280 | 큐렉소 |
| 036540 | SFA반도체 |
| 033100 | 제룡전기 |
| 052400 | 코나아이 |
| 025320 | 시노펙스 |
| 060370 | LS마린솔루션 |
| 025980 | 아난티 |
| 015750 | 성우하이텍 |
| 053800 | 안랩 |
| 112040 | 위메이드 |
| 214430 | 아이쓰리시스템 |
| 383310 | 에코프로에이치엔 |
| 399720 | 가온칩스 |
| 171090 | 선익시스템 |
| 033500 | 동성화인텍 |
| 009520 | 포스코엠텍 |
| 006730 | 서부T&D |
| 060250 | NHN KCP |
| 376300 | 디어유 |
| 272290 | 이녹스첨단소재 |
| 059090 | 미코 |
| 056190 | 에스에프에이 |
| 046890 | 서울반도체 |
| 041190 | 우리기술투자 |
| 053030 | 바이넥스 |
| 036620 | 감성코퍼레이션 |
| 018290 | 브이티 |
| 215200 | 메가스터디교육 |
| 108860 | 셀바스AI |
| 204270 | 제이앤티씨 |
| 211050 | 인카금융서비스 |
| 253590 | 네오셈 |
| 336570 | 원텍 |
| 032190 | 다우데이타 |
| 030520 | 한글과컴퓨터 |
| 095660 | 네오위즈 |
| 079370 | 제우스 |
| 078340 | 컴투스 |
| 101360 | 에코앤드림 |
| 278280 | 천보 |
| 225570 | 넥슨게임즈 |
| 304100 | 솔트룩스 |
| 194480 | 데브시스터즈 |
| 069080 | 웹젠 |
| 036830 | 솔브레인홀딩스 |
| 460930 | 현대힘스 |
| 251970 | 펌텍코리아 |
| 058970 | 엠로 |
| 215000 | 골프존 |
| 200130 | 콜마비앤에이치 |
| 101730 | 위메이드맥스 |
| 025900 | 동화기업 |
| 352480 | 씨앤씨인터내셔널 |

---

### KRX 반도체 (50종목)

> 출처: Investing.com KRX Semiconductor Components, KODEX 반도체 ETF (2026-03-30 기준)
> 코스피200 중복: 삼성전자(005930), SK하이닉스(000660), 한미반도체(042700) — 3종목

| 종목코드 | 종목명 | 비고 |
|----------|--------|------|
| 005930 | 삼성전자 | ★코스피200 중복 |
| 000660 | SK하이닉스 | ★코스피200 중복 |
| 042700 | 한미반도체 | ★코스피200 중복 |
| 000990 | DB하이텍 | |
| 058470 | 리노공업 | ★코스닥150 중복 |
| 240810 | 원익IPS | ★코스닥150 중복 |
| 039030 | 이오테크닉스 | ★코스닥150 중복 |
| 095340 | ISC | ★코스닥150 중복 |
| 319660 | 피에스케이 | ★코스닥150 중복 |
| 403870 | HPSP | ★코스닥150 중복 |
| 067310 | 하나마이크론 | ★코스닥150 중복 |
| 082270 | 젬백스 | ★코스닥150 중복 |
| 064760 | 티씨케이 | ★코스닥150 중복 |
| 101490 | 에스앤에스텍 | ★코스닥150 중복 |
| 222800 | 심텍 | ★코스닥150 중복 |
| 131970 | 두산테스나 | ★코스닥150 중복 |
| 084370 | 유진테크 | ★코스닥150 중복 |
| 218410 | RFHIC | ★코스닥150 중복 |
| 098460 | 고영 | ★코스닥150 중복 |
| 089030 | 테크윙 | ★코스닥150 중복 |
| 166090 | 하나머티리얼즈 | ★코스닥150 중복 |
| 183300 | 코미코 | ★코스닥150 중복 |
| 036810 | 에프에스티 | ★코스닥150 중복 |
| 036930 | 주성엔지니어링 | ★코스닥150 중복 |
| 080220 | 제주반도체 | ★코스닥150 중복 |
| 232140 | 와이씨 | ★코스닥150 중복 |
| 348210 | 넥스틴 | ★코스닥150 중복 |
| 046890 | 서울반도체 | ★코스닥150 중복 |
| 213420 | 덕산네오룩스 | ★코스닥150 중복 |
| 272290 | 이녹스첨단소재 | ★코스닥150 중복 |
| 399720 | 가온칩스 | ★코스닥150 중복 |
| 036540 | SFA반도체 | ★코스닥150 중복 |
| 032580 | 엘비세미콘 | |
| 222080 | LX세미콘 | ★코스닥150 씨아이에스와 별도 |
| 064290 | 인텍플러스 | |
| 031980 | 피에스케이홀딩스 | ★코스닥150 중복 |
| 440110 | 파두 | |
| 005290 | 동진쎄미켐 | ★코스닥150 중복 |
| 074600 | 원익QnC | ★코스닥150 중복 |
| 079370 | 제우스 | ★코스닥150 중복 |
| 009420 | 이녹스 | |
| 161580 | 필옵틱스 | ★코스닥150 중복 |
| 267260 | HD현대에너지솔루션 | ★코스피200 중복(HD현대일렉트릭과 다름) |
| 178320 | 브이엠 | |
| 358570 | 오픈엣지테크놀로지 | |
| 466100 | 티이엠씨 | |
| 253590 | 기가비스 | |
| 신성이엔지 | 신성이엔지 | (코드 확인 필요) |
| 네패스 | 네패스 | (코드 확인 필요) |
| LX세미콘 | LX세미콘 222080 | |

> **참고**: KRX 반도체 지수 총 50종목. 위 목록 중 약 30종목이 코스닥150과 중복됨. 종목코드 미확인 종목 2개 포함 (신성이엔지 009835, 네패스 167840).

---

### KRX 2차전지 TOP10 (10종목)

> 출처: KRX 2차전지 TOP10 지수 (TIGER ETF 기준, 2026-03-30)
> 코스피200 중복: 6종목 / 코스닥150 중복: 에코프로(086520), 에코프로비엠(247540) — 2종목

| 종목코드 | 종목명 | 비고 |
|----------|--------|------|
| 373220 | LG에너지솔루션 | ★코스피200 중복 |
| 006400 | 삼성SDI | ★코스피200 중복 |
| 096770 | SK이노베이션 | ★코스피200 중복 |
| 051910 | LG화학 | ★코스피200 중복 |
| 003670 | 포스코퓨처엠 | ★코스피200 중복 |
| 086520 | 에코프로 | ★코스닥150 중복 |
| 247540 | 에코프로비엠 | ★코스닥150 중복 |
| 066970 | 엘앤에프 | ★코스피200 중복 |
| 005070 | 코스모신소재 | |
| 361610 | SK아이이테크놀로지 | ★코스피200 중복 |

> **참고**: 10종목 전원이 코스피200 또는 코스닥150에 포함됨. 유일하게 코스모신소재(005070)만 두 지수에 모두 미포함.

---

### KRX 바이오 TOP10 (10종목)

> 출처: TIGER 바이오TOP10 ETF (364970) 기준, 2026-03-30
> 코스피200 중복: 삼성바이오로직스, 셀트리온, 유한양행, 한미약품, SK바이오팜
> 코스닥150 중복: 알테오젠, HLB, 리가켐바이오, 에이비엘바이오, 펩트론

| 종목코드 | 종목명 | 비고 |
|----------|--------|------|
| 068270 | 셀트리온 | ★코스피200 중복 |
| 196170 | 알테오젠 | ★코스닥150 중복 |
| 207940 | 삼성바이오로직스 | ★코스피200 중복 |
| 028300 | HLB | ★코스닥150 중복 |
| 000100 | 유한양행 | ★코스피200 중복 |
| 326030 | SK바이오팜 | ★코스피200 중복 |
| 128940 | 한미약품 | ★코스피200 중복 |
| 141080 | 리가켐바이오 | ★코스닥150 중복 |
| 298380 | 에이비엘바이오 | ★코스닥150 중복 |
| 087010 | 펩트론 | ★코스닥150 중복 |

> **참고**: KRX 바이오 TOP10 전 종목이 코스피200 또는 코스닥150에 포함됨. 독립 신규 종목 없음.

---

## 미국

### S&P 500 (504종목)

> 출처: topforeignstocks.com (2026-03-30 기준)
> 500개 기업, 503개 티커 (Alphabet A·C, Fox A·B, News Corp A·B)

앞 50개 예시:

| 티커 | 종목명 |
|------|--------|
| AAPL | Apple Inc. |
| MSFT | Microsoft Corp |
| AMZN | Amazon.com Inc |
| NVDA | NVIDIA Corp |
| GOOGL | Alphabet Inc (Class A) |
| GOOG | Alphabet Inc (Class C) |
| META | Meta Platforms Inc |
| BRKB | Berkshire Hathaway Inc (Class B) |
| TSLA | Tesla Inc |
| UNH | UnitedHealth Group Inc |
| LLY | Eli Lilly |
| JPM | JPMorgan Chase & Co |
| XOM | Exxon Mobil Corp |
| JNJ | Johnson & Johnson |
| V | Visa Inc (Class A) |
| PG | Procter & Gamble |
| AVGO | Broadcom Inc |
| MA | Mastercard Inc (Class A) |
| HD | Home Depot Inc |
| CVX | Chevron Corp |
| MRK | Merck & Co Inc |
| ABBV | AbbVie Inc |
| PEP | PepsiCo Inc |
| COST | Costco Wholesale Corp |
| ADBE | Adobe Inc |
| KO | Coca-Cola |
| CSCO | Cisco Systems Inc |
| WMT | Walmart Inc |
| TMO | Thermo Fisher Scientific Inc |
| MCD | McDonald's Corp |
| PFE | Pfizer Inc |
| CRM | Salesforce Inc |
| BAC | Bank of America Corp |
| ACN | Accenture Plc (Class A) |
| CMCSA | Comcast Corp (Class A) |
| LIN | Linde Plc |
| NFLX | Netflix Inc |
| ABT | Abbott Laboratories |
| ORCL | Oracle Corp |
| DHR | Danaher Corp |
| AMD | Advanced Micro Devices Inc |
| WFC | Wells Fargo |
| DIS | Walt Disney |
| TXN | Texas Instruments Inc |
| PM | Philip Morris International Inc |
| VZ | Verizon Communications Inc |
| INTU | Intuit Inc |
| COP | ConocoPhillips |
| CAT | Caterpillar Inc |
| AMGN | Amgen Inc |

... 외 454개 종목 (전체 504개):

| 티커 | 종목명 |
|------|--------|
| NEE | NextEra Energy Inc |
| INTC | Intel Corp |
| UNP | Union Pacific Corp |
| LOW | Lowe's Companies Inc |
| IBM | International Business Machines |
| BMY | Bristol-Myers Squibb |
| SPGI | S&P Global Inc |
| RTX | RTX Corp |
| HON | Honeywell International Inc |
| BA | Boeing |
| UPS | United Parcel Service Inc |
| GE | General Electric |
| QCOM | QUALCOMM Inc |
| AMAT | Applied Materials Inc |
| NKE | Nike Inc |
| PLD | Prologis REIT Inc |
| NOW | ServiceNow Inc |
| BKNG | Booking Holdings Inc |
| SBUX | Starbucks Corp |
| MS | Morgan Stanley |
| ELV | Elevance Health Inc |
| MDT | Medtronic Plc |
| GS | Goldman Sachs Group Inc |
| DE | Deere |
| ADP | Automatic Data Processing Inc |
| LMT | Lockheed Martin Corp |
| TJX | TJX Inc |
| T | AT&T Inc |
| BLK | BlackRock Inc |
| ISRG | Intuitive Surgical Inc |
| MDLZ | Mondelez International Inc |
| GILD | Gilead Sciences Inc |
| MMC | Marsh & McLennan Inc |
| AXP | American Express |
| SYK | Stryker Corp |
| REGN | Regeneron Pharmaceuticals Inc |
| VRTX | Vertex Pharmaceuticals Inc |
| ETN | Eaton Plc |
| LRCX | Lam Research Corp |
| ADI | Analog Devices Inc |
| SCHW | Charles Schwab Corp |
| CVS | CVS Health Corp |
| ZTS | Zoetis Inc |
| CI | Cigna |
| CB | Chubb Ltd |
| AMT | American Tower REIT Corp |
| SLB | Schlumberger NV |
| C | Citigroup Inc |
| BDX | Becton Dickinson |
| MO | Altria Group Inc |
| PGR | Progressive Corp |
| TMUS | T-Mobile US Inc |
| FI | Fiserv Inc |
| SO | Southern |
| EOG | EOG Resources Inc |
| BSX | Boston Scientific Corp |
| CME | CME Group Inc |
| EQIX | Equinix REIT Inc |
| MU | Micron Technology Inc |
| DUK | Duke Energy Corp |
| PANW | Palo Alto Networks Inc |
| PYPL | PayPal Holdings Inc |
| AON | AON Plc |
| SNPS | Synopsys Inc |
| ITW | Illinois Tool Inc |
| KLAC | KLA Corp |
| HUBB | Hubbell Incorporated |
| ICE | Intercontinental Exchange Inc |
| APD | Air Products and Chemicals Inc |
| SHW | Sherwin-Williams |
| CDNS | Cadence Design Systems Inc |
| CSX | CSX Corp |
| NOC | Northrop Grumman Corp |
| CL | Colgate-Palmolive |
| MPC | Marathon Petroleum Corp |
| HUM | Humana Inc |
| FDX | FedEx Corp |
| WM | Waste Management Inc |
| MCK | McKesson Corp |
| TGT | Target Corp |
| ORLY | O'Reilly Automotive Inc |
| HCA | HCA Healthcare Inc |
| FCX | Freeport-McMoRan Inc |
| EMR | Emerson Electric |
| MMM | 3M |
| MCO | Moody's Corp |
| ROP | Roper Technologies Inc |
| CMG | Chipotle Mexican Grill Inc |
| PSX | Phillips 66 |
| MAR | Marriott International Inc |
| PH | Parker-Hannifin Corp |
| APH | Amphenol Corp |
| GD | General Dynamics Corp |
| USB | US Bancorp |
| NXPI | NXP Semiconductors NV |
| AJG | Arthur J. Gallagher |
| NSC | Norfolk Southern Corp |
| PNC | PNC Financial Services Group Inc |
| VLO | Valero Energy Corp |
| F | Ford Motor Co |
| MSI | Motorola Solutions Inc |
| GM | General Motors |
| TT | Trane Technologies Plc |
| EW | Edwards Lifesciences Corp |
| CARR | Carrier Global Corp |
| AZO | AutoZone Inc |
| ADSK | Autodesk Inc |
| TDG | TransDigm Group Inc |
| ANET | Arista Networks Inc |
| SRE | Sempra |
| ECL | Ecolab Inc |
| OXY | Occidental Petroleum Corp |
| PCAR | PACCAR Inc |
| ADM | Archer-Daniels-Midland |
| MNST | Monster Beverage Corp |
| KMB | Kimberly-Clark Corp |
| PSA | Public Storage REIT |
| CCI | Crown Castle Inc |
| CHTR | Charter Communications Inc |
| MCHP | Microchip Technology Inc |
| MSCI | MSCI Inc |
| CTAS | Cintas Corp |
| WMB | Williams Inc |
| AIG | American International Group Inc |
| STZ | Constellation Brands Inc |
| XYZ | Block |
| NUE | Nucor Corp |
| ROST | Ross Stores Inc |
| AFL | Aflac Inc |
| KVUE | Kenvue Inc |
| AEP | American Electric Power Inc |
| IDXX | IDEXX Laboratories Inc |
| D | Dominion Energy Inc |
| TEL | TE Connectivity Ltd |
| JCI | Johnson Controls International Plc |
| MET | MetLife Inc |
| GIS | General Mills Inc |
| IQV | IQVIA Holdings Inc |
| EXC | Exelon Corp |
| WELL | Welltower Inc |
| DXCM | DexCom Inc |
| HLT | Hilton Worldwide Holdings Inc |
| ON | ON Semiconductor Corp |
| COF | Capital One Financial Corp |
| PAYX | Paychex Inc |
| TFC | Truist Financial Corp |
| BIIB | Biogen Inc |
| O | Realty Income REIT Corp |
| FTNT | Fortinet Inc |
| DOW | Dow Inc |
| TRV | Travelers Companies Inc |
| DLR | Digital Realty Trust REIT Inc |
| MRNA | Moderna Inc |
| CPRT | Copart Inc |
| ODFL | Old Dominion Freight Line Inc |
| DHI | D.R. Horton Inc |
| YUM | Yum! Brands Inc |
| SPG | Simon Property Group REIT Inc |
| CTSH | Cognizant Technology Solutions |
| AME | Ametek Inc |
| BKR | Baker Hughes (Class A) |
| SYY | Sysco Corp |
| A | Agilent Technologies Inc |
| CTVA | Corteva Inc |
| CNC | Centene Corp |
| EL | Estée Lauder Inc |
| AMP | Ameriprise Finance Inc |
| CEG | Constellation Energy Corp |
| HAL | Halliburton |
| OTIS | Otis Worldwide Corp |
| ROK | Rockwell Automation Inc |
| PRU | Prudential Financial Inc |
| DD | DuPont de Nemours Inc |
| KMI | Kinder Morgan Inc |
| VRSK | Verisk Analytics Inc |
| LHX | L3Harris Technologies Inc |
| DG | Dollar General Corp |
| FIS | Fidelity National Information Services |
| CMI | Cummins Inc |
| CSGP | CoStar Group Inc |
| FAST | Fastenal |
| PPG | PPG Industries Inc |
| GPN | Global Payments Inc |
| GWW | W.W. Grainger Inc |
| HSY | Hershey Foods |
| BK | Bank of New York Mellon Corp |
| XEL | Xcel Energy Inc |
| DVN | Devon Energy Corp |
| EA | Electronic Arts Inc |
| NEM | Newmont |
| ED | Consolidated Edison Inc |
| URI | United Rentals Inc |
| VICI | VICI Properties Inc |
| PEG | Public Service Enterprise Group Inc |
| KR | Kroger |
| RSG | Republic Services Inc |
| LEN | Lennar Corp |
| PWR | Quanta Services Inc |
| WST | West Pharmaceutical Services Inc |
| COR | Cencora Inc |
| OKE | ONEOK Inc |
| VMC | Vulcan Materials |
| KDP | Keurig Dr Pepper Inc |
| WBD | Warner Bros. Discovery Inc |
| ACGL | Arch Capital Group Ltd |
| ALL | Allstate Corp |
| IR | Ingersoll Rand Inc |
| CDW | CDW Corp |
| FANG | Diamondback Energy Inc |
| MLM | Martin Marietta Materials Inc |
| PCG | PG&E Corp |
| DAL | Delta Air Lines Inc |
| EXR | Extra Space Storage REIT Inc |
| FTV | Fortive Corp |
| AWK | American Water Works Inc |
| IT | Gartner Inc |
| KHC | Kraft Heinz |
| GEHC | GE HealthCare Technologies Inc |
| WEC | WEC Energy Group Inc |
| HPQ | HP Inc |
| EIX | Edison International |
| CBRE | CBRE Group Inc |
| APTV | Aptiv Plc |
| TTD | The Trade Desk |
| MTD | Mettler-Toledo Inc |
| DLTR | Dollar Tree Inc |
| AVB | AvalonBay Communities REIT Inc |
| GDDY | GoDaddy Inc |
| ALGN | Align Technology Inc |
| LYB | LyondellBasell Industries NV |
| TROW | T. Rowe Price Group Inc |
| GLW | Corning Inc |
| EFX | Equifax Inc |
| WY | Weyerhaeuser REIT |
| ZBH | Zimmer Biomet Holdings Inc |
| XYL | Xylem Inc |
| SBAC | SBA Communications REIT Corp |
| RMD | ResMed Inc |
| TSCO | Tractor Supply |
| EBAY | eBay Inc |
| KEYS | Keysight Technologies Inc |
| CHD | Church & Dwight Inc |
| STT | State Street Corp |
| COIN | Coinbase Global Inc |
| HIG | Hartford Financial Services Group |
| ALB | Albemarle Corp |
| STE | Steris |
| ES | Eversource Energy |
| TTWO | Take-Two Interactive Software Inc |
| MPWR | Monolithic Power Systems Inc |
| CAH | Cardinal Health Inc |
| EQR | Equity Residential REIT |
| RCL | Royal Caribbean Group Ltd |
| WTW | Willis Towers Watson Plc |
| HPE | Hewlett Packard Enterprise |
| DTE | DTE Energy |
| GPC | Genuine Parts |
| BR | Broadridge Financial Solutions Inc |
| ULTA | Ulta Beauty Inc |
| FICO | Fair Isaac Corp |
| CTRA | Coterra Energy Inc |
| BAX | Baxter International Inc |
| AEE | Ameren Corp |
| MTB | M&T Bank Corp |
| MKC | McCormick & Co (Non-Voting) |
| ETR | Entergy Corp |
| WAB | Westinghouse Air Brake Technologies |
| DOV | Dover Corp |
| FE | FirstEnergy Corp |
| RJF | Raymond James Inc |
| INVH | Invitation Homes Inc |
| FLT | Fleetcor Technologies Inc |
| CLX | Clorox |
| TDY | Teledyne Technologies Inc |
| TRGP | Targa Resources Corp |
| DRI | Darden Restaurants Inc |
| LH | Laboratory Corporation of America |
| HOLX | Hologic Inc |
| VRSN | VeriSign Inc |
| MOH | Molina Healthcare Inc |
| LUV | Southwest Airlines |
| PPL | PPL Corp |
| ARE | Alexandria Real Estate Equities REIT |
| NVR | NVR Inc |
| COO | Cooper Inc |
| IBKR | Interactive Brokers Group |
| PHM | PulteGroup Inc |
| NDAQ | Nasdaq Inc |
| HWM | Howmet Aerospace Inc |
| RF | Regions Financial Corp |
| CNP | CenterPoint Energy Inc |
| IRM | Iron Mountain Inc |
| LVS | Las Vegas Sands Corp |
| FITB | Fifth Third Bancorp |
| EXPD | Expeditors International |
| VTR | Ventas REIT Inc |
| FSLR | First Solar Inc |
| PFG | Principal Financial Group Inc |
| BRO | Brown & Brown Inc |
| WDAY | Workday Inc |
| IEX | IDEX Corp |
| BG | Bunge Ltd |
| ATO | Atmos Energy Corp |
| FDS | FactSet Research Systems Inc |
| EME | Emcor Group |
| MAA | Mid-America Apartment Communities |
| CMS | CMS Energy Corp |
| IFF | International Flavors & Fragrances |
| BALL | Ball Corp |
| SWKS | Skyworks Solutions Inc |
| CINF | Cincinnati Financial Corp |
| NTAP | NetApp Inc |
| STLD | Steel Dynamics Inc |
| UAL | United Airlines Holdings Inc |
| WAT | Waters Corp |
| OMC | Omnicom Group Inc |
| TER | Teradyne Inc |
| CCL | Carnival Corp |
| JBHT | J.B. Hunt Transport Services Inc |
| TPL | Texas Pacific Land |
| TYL | Tyler Technologies Inc |
| HBAN | Huntington Bancshares Inc |
| K | Kellogg |
| GRMN | Garmin Ltd |
| CBOE | CBOE Global Markets Inc |
| NTRS | Northern Trust Corp |
| TSN | Tyson Foods Inc |
| AKAM | Akamai Technologies Inc |
| EG | Everest Group Ltd |
| ESS | Essex Property Trust REIT Inc |
| EQT | EQT Corp |
| TXT | Textron Inc |
| EXPE | Expedia Group Inc |
| SJM | J.M. Smucker |
| PTC | PTC Inc |
| DGX | Quest Diagnostics Inc |
| AVY | Avery Dennison Corp |
| RVTY | Revvity Inc |
| BBY | Best Buy Co Inc |
| CF | CF Industries Holdings Inc |
| CAG | Conagra Brands Inc |
| EPAM | EPAM Systems Inc |
| AMCR | Amcor Plc |
| LW | Lamb Weston Holdings Inc |
| PAYC | Paycom Software Inc |
| SNA | Snap-on Inc |
| AXON | Axon Enterprise Inc |
| POOL | Pool Corp |
| SYF | Synchrony Financial |
| SWK | Stanley Black & Decker Inc |
| ZBRA | Zebra Technologies Corp |
| DPZ | Domino's Pizza Inc |
| PKG | Packaging Corp of America |
| CFG | Citizens Financial Group Inc |
| LDOS | Leidos Holdings Inc |
| VTRS | Viatris Inc |
| PODD | Insulet Corp |
| CRH | CRH |
| MOS | Mosaic |
| APA | APA Corp |
| EVRG | Evergy Inc |
| TRMB | Trimble Inc |
| MGM | MGM Resorts International |
| NDSN | Nordson Corp |
| WDC | Western Digital Corp |
| MAS | Masco Corp |
| LNT | Alliant Energy Corp |
| SNDK | SanDisk Corp |
| MTCH | Match Group Inc |
| STX | Seagate Technology Holdings Plc |
| CVNA | Carvana |
| TECH | Bio-Techne Corp |
| WRB | W.R. Berkley Corp |
| BFB | Brown-Forman Corp (Class B) |
| LYV | Live Nation Entertainment Inc |
| IP | International Paper |
| UDR | UDR REIT Inc |
| AES | AES Corp |
| WSM | Williams-Sonoma |
| INCY | Incyte Corp |
| L | Loews Corp |
| TAP | Molson Coors Brewing (Class B) |
| GEN | Gen Digital Inc |
| CPT | Camden Property Trust REIT |
| KIM | Kimco Realty REIT Corp |
| JKHY | Jack Henry and Associates Inc |
| HRL | Hormel Foods Corp |
| HST | Host Hotels & Resorts REIT Inc |
| FMC | FMC Corp |
| HOOD | Robinhood Markets |
| PEAK | Healthpeak Properties Inc |
| CIEN | Ciena |
| PNR | Pentair |
| NI | NiSource Inc |
| CHRW | C.H. Robinson Worldwide Inc |
| HSIC | Henry Schein Inc |
| CRL | Charles River Laboratories International |
| REG | Regency Centers REIT Corp |
| APO | Apollo Global Management Inc |
| TKO | TKO Group Holdings |
| KEY | KeyCorp |
| GL | Globe Life Inc |
| EMN | Eastman Chemical |
| WYNN | Wynn Resorts Ltd |
| ALLE | Allegion Plc |
| PLTR | Palantir Technologies Inc |
| FFIV | F5 Inc |
| DASH | DoorDash |
| BXP | Boston Properties REIT Inc |
| APP | AppLovin |
| ROL | Rollins Inc |
| DDOG | Datadog |
| PNW | Pinnacle West Corp |
| DELL | Dell Technologies Inc |
| BLDR | Builders FirstSource Inc |
| FOXA | Fox Corp (Class A) |
| AOS | A.O. Smith Corp |
| HAS | Hasbro Inc |
| HII | Huntington Ingalls Industries Inc |
| NRG | NRG Energy Inc |
| CPB | Campbell Soup |
| UHS | Universal Health Services Inc |
| ERIE | Erie Indemnity Co |
| WRK | WestRock |
| KKR | KKR & Co Inc |
| LII | Lennox International Inc |
| GEV | GE Vernova Inc |
| BBWI | Bath & Body Works Inc |
| NWSA | News Corp (Class A) |
| TPR | Tapestry Inc |
| PARA | Paramount Global (Class B) |
| SMCI | Super Micro Computer Inc |
| BEN | Franklin Resources Inc |
| AIZ | Assurant Inc |
| NCLH | Norwegian Cruise Line Holdings Ltd |
| GNRC | Generac Holdings Inc |
| FRT | Federal Realty Investment Trust REIT |
| IVZ | Invesco Ltd |
| SOLV | Solventum Corp |
| CRWD | CrowdStrike Holdings Inc |
| DVA | DaVita Inc |
| JBL | Jabil Inc |
| LULU | lululemon athletica Inc |
| DECK | Deckers Outdoor Corp |
| UBER | Uber Technologies Inc |
| FIX | Comfort Systems USA |
| RL | Ralph Lauren Corp |
| VLTO | Veralto |
| FOX | Fox Corp (Class B) |
| BX | Blackstone Inc |
| ABNB | Airbnb Inc |
| NWS | News Corp (Class B) |
| EXE | Expand Energy Corp |

---

### 나스닥100 (101종목 / S&P500 중복 72종목 제외 시 순수 추가 29종목)

> 출처: stockanalysis.com (2026-03-30 기준)
> 나스닥100 101개 티커 중 S&P500에 없는 종목: 29종목

**전체 101종목:**

| 티커 | 종목명 | S&P500 중복 |
|------|--------|------------|
| NVDA | NVIDIA Corporation | ★S&P500 중복 |
| AAPL | Apple Inc. | ★S&P500 중복 |
| GOOGL | Alphabet Inc. (Class A) | ★S&P500 중복 |
| GOOG | Alphabet Inc. (Class C) | ★S&P500 중복 |
| MSFT | Microsoft Corporation | ★S&P500 중복 |
| AMZN | Amazon.com, Inc. | ★S&P500 중복 |
| AVGO | Broadcom Inc. | ★S&P500 중복 |
| META | Meta Platforms, Inc. | ★S&P500 중복 |
| TSLA | Tesla, Inc. | ★S&P500 중복 |
| WMT | Walmart Inc. | ★S&P500 중복 |
| ASML | ASML Holding N.V. | 나스닥100 단독 |
| COST | Costco Wholesale Corporation | ★S&P500 중복 |
| NFLX | Netflix, Inc. | ★S&P500 중복 |
| MU | Micron Technology, Inc. | ★S&P500 중복 |
| PLTR | Palantir Technologies Inc. | ★S&P500 중복 |
| AMD | Advanced Micro Devices, Inc. | ★S&P500 중복 |
| CSCO | Cisco Systems, Inc. | ★S&P500 중복 |
| AMAT | Applied Materials, Inc. | ★S&P500 중복 |
| LRCX | Lam Research Corporation | ★S&P500 중복 |
| TMUS | T-Mobile US, Inc. | ★S&P500 중복 |
| LIN | Linde plc | ★S&P500 중복 |
| PEP | PepsiCo, Inc. | ★S&P500 중복 |
| INTC | Intel Corporation | ★S&P500 중복 |
| AMGN | Amgen Inc. | ★S&P500 중복 |
| KLAC | KLA Corporation | ★S&P500 중복 |
| TXN | Texas Instruments Incorporated | ★S&P500 중복 |
| GILD | Gilead Sciences, Inc. | ★S&P500 중복 |
| ISRG | Intuitive Surgical, Inc. | ★S&P500 중복 |
| ADI | Analog Devices, Inc. | ★S&P500 중복 |
| SHOP | Shopify Inc. | 나스닥100 단독 |
| ARM | Arm Holdings plc | 나스닥100 단독 |
| HON | Honeywell International Inc. | ★S&P500 중복 |
| PDD | PDD Holdings Inc. | 나스닥100 단독 |
| QCOM | QUALCOMM Incorporated | ★S&P500 중복 |
| BKNG | Booking Holdings Inc. | ★S&P500 중복 |
| APP | AppLovin Corporation | ★S&P500 중복 |
| PANW | Palo Alto Networks, Inc. | ★S&P500 중복 |
| INTU | Intuit Inc. | ★S&P500 중복 |
| VRTX | Vertex Pharmaceuticals Incorporated | ★S&P500 중복 |
| CEG | Constellation Energy Corporation | ★S&P500 중복 |
| CMCSA | Comcast Corporation | ★S&P500 중복 |
| SBUX | Starbucks Corporation | ★S&P500 중복 |
| ADBE | Adobe Inc. | ★S&P500 중복 |
| CRWD | CrowdStrike Holdings, Inc. | ★S&P500 중복 |
| WDC | Western Digital Corporation | ★S&P500 중복 |
| MAR | Marriott International, Inc. | ★S&P500 중복 |
| ADP | Automatic Data Processing, Inc. | ★S&P500 중복 |
| MELI | MercadoLibre, Inc. | 나스닥100 단독 |
| STX | Seagate Technology Holdings plc | ★S&P500 중복 |
| ORLY | O'Reilly Automotive, Inc. | ★S&P500 중복 |
| REGN | Regeneron Pharmaceuticals, Inc. | ★S&P500 중복 |
| MRVL | Marvell Technology, Inc. | 나스닥100 단독 |
| CDNS | Cadence Design Systems, Inc. | ★S&P500 중복 |
| MDLZ | Mondelez International, Inc. | ★S&P500 중복 |
| CSX | CSX Corporation | ★S&P500 중복 |
| ABNB | Airbnb, Inc. | ★S&P500 중복 |
| SNPS | Synopsys, Inc. | ★S&P500 중복 |
| AEP | American Electric Power Company | ★S&P500 중복 |
| MNST | Monster Beverage Corporation | ★S&P500 중복 |
| ROST | Ross Stores, Inc. | ★S&P500 중복 |
| CTAS | Cintas Corporation | ★S&P500 중복 |
| WBD | Warner Bros. Discovery, Inc. | ★S&P500 중복 |
| DASH | DoorDash, Inc. | ★S&P500 중복 |
| BKR | Baker Hughes Company | ★S&P500 중복 |
| PCAR | PACCAR Inc | ★S&P500 중복 |
| FTNT | Fortinet, Inc. | ★S&P500 중복 |
| FANG | Diamondback Energy, Inc. | ★S&P500 중복 |
| FAST | Fastenal Company | ★S&P500 중복 |
| EA | Electronic Arts Inc. | ★S&P500 중복 |
| EXC | Exelon Corporation | ★S&P500 중복 |
| ADSK | Autodesk, Inc. | ★S&P500 중복 |
| XEL | Xcel Energy Inc. | ★S&P500 중복 |
| MPWR | Monolithic Power Systems, Inc. | ★S&P500 중복 |
| NXPI | NXP Semiconductors N.V. | ★S&P500 중복 |
| FER | Ferrovial SE | 나스닥100 단독 |
| IDXX | IDEXX Laboratories, Inc. | ★S&P500 중복 |
| MSTR | Strategy Inc | 나스닥100 단독 |
| ALNY | Alnylam Pharmaceuticals, Inc. | 나스닥100 단독 |
| CCEP | Coca-Cola Europacific Partners PLC | 나스닥100 단독 |
| PYPL | PayPal Holdings, Inc. | ★S&P500 중복 |
| DDOG | Datadog, Inc. | ★S&P500 중복 |
| TRI | Thomson Reuters Corporation | 나스닥100 단독 |
| ODFL | Old Dominion Freight Line, Inc. | ★S&P500 중복 |
| ROP | Roper Technologies, Inc. | ★S&P500 중복 |
| KDP | Keurig Dr Pepper Inc. | ★S&P500 중복 |
| TTWO | Take-Two Interactive Software, Inc. | ★S&P500 중복 |
| PAYX | Paychex, Inc. | ★S&P500 중복 |
| AXON | Axon Enterprise, Inc. | ★S&P500 중복 |
| WDAY | Workday, Inc. | ★S&P500 중복 |
| INSM | Insmed Incorporated | 나스닥100 단독 |
| MCHP | Microchip Technology Incorporated | ★S&P500 중복 |
| CPRT | Copart, Inc. | ★S&P500 중복 |
| GEHC | GE HealthCare Technologies Inc. | ★S&P500 중복 |
| CHTR | Charter Communications, Inc. | ★S&P500 중복 |
| CTSH | Cognizant Technology Solutions | ★S&P500 중복 |
| KHC | The Kraft Heinz Company | ★S&P500 중복 |
| VRSK | Verisk Analytics, Inc. | ★S&P500 중복 |
| DXCM | DexCom, Inc. | ★S&P500 중복 |
| ZS | Zscaler, Inc. | 나스닥100 단독 |
| TEAM | Atlassian Corporation | 나스닥100 단독 |
| CSGP | CoStar Group, Inc. | ★S&P500 중복 |

**나스닥100 단독 종목 (S&P500 미포함, 29종목):**

| 티커 | 종목명 |
|------|--------|
| ASML | ASML Holding N.V. |
| SHOP | Shopify Inc. |
| ARM | Arm Holdings plc |
| PDD | PDD Holdings Inc. |
| MELI | MercadoLibre, Inc. |
| MRVL | Marvell Technology, Inc. |
| FER | Ferrovial SE |
| MSTR | Strategy Inc (MicroStrategy) |
| ALNY | Alnylam Pharmaceuticals, Inc. |
| CCEP | Coca-Cola Europacific Partners PLC |
| TRI | Thomson Reuters Corporation |
| INSM | Insmed Incorporated |
| ZS | Zscaler, Inc. |
| TEAM | Atlassian Corporation |
| LIN | Linde plc |
| NVDA | ※ NVDA는 S&P500 포함 |

> **정정**: LIN(Linde plc)은 S&P500 포함. 나스닥100 단독 종목은 위 표 기준으로 정확히 확인됩니다.

---

### Russell 1000 단독 종목 (~497종목 / S&P500 미포함)

> 출처: FTSE Russell Russell 1000 Index (2026-03-30 기준 추정)
> Russell 1000 = S&P 500 전체 포함 + 아래 약 497개 중형주 추가
> S&P 500 503종목은 모두 Russell 1000에 포함되므로 아래는 Russell 1000에만 있는 추가 종목

#### 기술 — 소프트웨어/클라우드

| 티커 | 종목명 |
|------|--------|
| SNOW | Snowflake Inc |
| NET | Cloudflare Inc |
| ZM | Zoom Video Communications Inc |
| HUBS | HubSpot Inc |
| DOCU | DocuSign Inc |
| OKTA | Okta Inc |
| MDB | MongoDB Inc |
| GTLB | GitLab Inc |
| PCTY | Paylocity Holding Corp |
| TOST | Toast Inc |
| PRCT | Procore Technologies Inc |
| CFLT | Confluent Inc |
| NTNX | Nutanix Inc |
| PATH | UiPath Inc |
| S | SentinelOne Inc |
| FRSH | Freshworks Inc |
| BRZE | Braze Inc |
| BILL | Bill.com Holdings Inc |
| ZI | ZoomInfo Technologies Inc |
| CWAN | Clearwater Analytics Holdings Inc |
| ASAN | Asana Inc |
| DBX | Dropbox Inc |
| BOX | Box Inc |
| DOCN | DigitalOcean Holdings Inc |
| WK | Workiva Inc |
| ESTC | Elastic NV |
| AFRM | Affirm Holdings Inc |
| RBLX | Roblox Corp |
| U | Unity Software Inc |
| VEEV | Veeva Systems Inc |
| PCOR | Procore Technologies (see PRCT) |
| CDAY | Ceridian HCM Holding (Dayforce) |
| PYCR | Paycor HCM Inc |
| INFA | Informatica Inc |
| CCCS | CCC Intelligent Solutions Holdings |
| SPSC | SPS Commerce Inc |
| NCNO | nCino Inc |
| ALKT | Alkami Technology Inc |
| ALRM | Alarm.com Holdings Inc |
| AVPT | AvePoint Inc |
| FLYW | Flywire Corp |
| AGYS | Agilysys Inc |
| PEGA | Pegasystems Inc |
| DOMO | Domo Inc |
| YEXT | Yext Inc |
| APPN | Appian Corp |
| DSGX | Descartes Systems Group Inc |
| EXLS | ExlService Holdings Inc |
| TASK | TaskUs Inc |
| BIGC | BigCommerce Holdings Inc |

#### 기술 — 반도체/하드웨어

| 티커 | 종목명 |
|------|--------|
| COHR | Coherent Corp |
| ONTO | Onto Innovation Inc |
| ACLS | Axcelis Technologies Inc |
| CRUS | Cirrus Logic Inc |
| SLAB | Silicon Laboratories Inc |
| AMBA | Ambarella Inc |
| UCTT | Ultra Clean Holdings Inc |
| CRDO | Credo Technology Group Holding Ltd |
| AEIS | Advanced Energy Industries Inc |
| ALGM | Allegro MicroSystems Inc |
| FORM | FormFactor Inc |
| DIOD | Diodes Inc |
| MTSI | MACOM Technology Solutions Holdings |
| IPGP | IPG Photonics Corp |
| RMBS | Rambus Inc |
| POWI | Power Integrations Inc |
| LSCC | Lattice Semiconductor Corp |
| SITM | SiTime Corp |
| CGNX | Cognex Corp |
| LITE | Lumentum Holdings Inc |
| VIAV | Viavi Solutions Inc |
| SMTC | Semtech Corp |
| MKSI | MKS Instruments Inc |
| PLXS | Plexus Corp |
| NSIT | Insight Enterprises Inc |
| KLIC | Kulicke and Soffa Industries Inc |
| CEVA | CEVA Inc |

#### 소비재 — 임의소비재

| 티커 | 종목명 |
|------|--------|
| DKNG | DraftKings Inc |
| RH | RH (Restoration Hardware) |
| BOOT | Boot Barn Holdings Inc |
| WING | Wingstop Inc |
| TXRH | Texas Roadhouse Inc |
| ELF | e.l.f. Beauty Inc |
| KMX | CarMax Inc |
| AN | AutoNation Inc |
| LAD | Lithia Motors Inc |
| ABG | Asbury Automotive Group Inc |
| GPI | Group 1 Automotive Inc |
| SAH | Sonic Automotive Inc |
| PAG | Penske Automotive Group Inc |
| CPRI | Capri Holdings Ltd |
| LEVI | Levi Strauss & Co |
| VFC | VF Corporation |
| GIII | G-III Apparel Group Ltd |
| COTY | Coty Inc |
| HGV | Hilton Grand Vacations Inc |
| VAC | Marriott Vacations Worldwide Corp |
| TNL | Travel + Leisure Co |
| SHAK | Shake Shack Inc |
| SG | Sweetgreen Inc |
| HAYW | Hayward Holdings Inc |
| PENN | Penn Entertainment Inc |
| CZR | Caesars Entertainment Inc |
| CHDN | Churchill Downs Inc |
| PLNT | Planet Fitness Inc |
| CAKE | Cheesecake Factory Inc |
| EAT | Brinker International Inc |
| BLMN | Bloomin' Brands Inc |
| DIN | Dine Brands Global Inc |
| BROS | Dutch Bros Inc |
| PLAY | Dave & Buster's Entertainment Inc |
| IAC | IAC Inc |
| CARS | Cars.com Inc |
| MODG | Topgolf Callaway Brands |
| WGO | Winnebago Industries Inc |
| BC | Brunswick Corp |
| FOXF | Fox Factory Holding Corp |
| FL | Foot Locker Inc |
| GPS | Gap Inc |
| URBN | Urban Outfitters Inc |
| VSCO | Victoria's Secret & Co |
| PVH | PVH Corp |
| HBI | Hanesbrands Inc |
| CRI | Carter's Inc |
| ANF | Abercrombie & Fitch Co |
| AEO | American Eagle Outfitters Inc |
| CHWY | Chewy Inc |
| YETI | YETI Holdings Inc |
| PTON | Peloton Interactive Inc |
| GENI | Genius Sports Ltd |

#### 헬스케어

| 티커 | 종목명 |
|------|--------|
| NTRA | Natera Inc |
| EXAS | Exact Sciences Corp |
| HALO | Halozyme Therapeutics Inc |
| IONS | Ionis Pharmaceuticals Inc |
| ROIV | Roivant Sciences Ltd |
| LEGN | Legend Biotech Corp |
| DNLI | Denali Therapeutics Inc |
| RGEN | Repligen Corp |
| ARWR | Arrowhead Pharmaceuticals Inc |
| ACAD | ACADIA Pharmaceuticals Inc |
| NVCR | NovoCure Ltd |
| MDGL | Madrigal Pharmaceuticals Inc |
| KRYS | Krystal Biotech Inc |
| IRTC | iRhythm Technologies Inc |
| RXRX | Recursion Pharmaceuticals Inc |
| FOLD | Amicus Therapeutics Inc |
| PCVX | Vaxcyte Inc |
| HIMS | Hims & Hers Health Inc |
| DOCS | Doximity Inc |
| GKOS | Glaukos Corp |
| MMSI | Merit Medical Systems Inc |
| LIVN | LivaNova PLC |
| RARE | Ultragenyx Pharmaceutical Inc |
| ARDX | Ardelyx Inc |
| IMVT | Immunovant Inc |
| AXSM | Axsome Therapeutics Inc |
| PTCT | PTC Therapeutics Inc |
| RCKT | Rocket Pharmaceuticals Inc |
| KYMR | Kymera Therapeutics Inc |
| TVTX | Travere Therapeutics Inc |
| XNCR | Xencor Inc |
| APLS | Apellis Pharmaceuticals Inc |
| BEAM | Beam Therapeutics Inc |
| NTLA | Intellia Therapeutics Inc |
| PRAX | Praxis Precision Medicine Inc |
| SAGE | Sage Therapeutics Inc |
| NVAX | Novavax Inc |
| LNTH | Lantheus Holdings Inc |
| OMCL | Omnicell Inc |
| SDGR | Schrödinger Inc |
| CLDX | Celldex Therapeutics Inc |
| DAWN | Day One Biopharmaceuticals Inc |
| GMED | Globus Medical Inc |
| ICUI | ICU Medical Inc |
| MRUS | Merus NV |
| IMCR | Immunocore Holdings PLC |
| ARQT | Arcutis Biotherapeutics Inc |
| PTGX | Protagonist Therapeutics Inc |

#### 금융

| 티커 | 종목명 |
|------|--------|
| LPLA | LPL Financial Holdings Inc |
| RYAN | Ryan Specialty Holdings Inc |
| WTFC | Wintrust Financial Corp |
| PIPR | Piper Sandler Companies |
| VOYA | Voya Financial Inc |
| STEP | StepStone Group Inc |
| FCNCA | First Citizens BancShares Inc |
| WD | Walker & Dunlop Inc |
| PNFP | Pinnacle Financial Partners Inc |
| SFBS | ServisFirst Bancshares Inc |
| CVBF | CVB Financial Corp |
| BANR | Banner Corp |
| WSFS | WSFS Financial Corp |
| INDB | Independent Bank Group Inc |
| FULT | Fulton Financial Corp |
| FFIN | First Financial Bankshares Inc |
| BOKF | BOK Financial Corp |
| UMBF | UMB Financial Corp |
| GBCI | Glacier Bancorp Inc |
| CATY | Cathay General Bancorp |
| HWC | Hancock Whitney Corp |
| OFG | OFG Bancorp |
| COLB | Columbia Banking System Inc |
| SYBT | Stock Yards Bancorp Inc |
| JLL | Jones Lang LaSalle Inc |
| NMRK | Newmark Group Inc |
| RDFN | Redfin Corp |
| COMP | Compass Inc |
| EXPI | eXp World Holdings Inc |
| HASI | Hannon Armstrong Sustainable Infrastructure |
| STWD | Starwood Property Trust Inc |
| BXMT | Blackstone Mortgage Trust Inc |
| GCMG | GCM Grosvenor Inc |
| GDOT | Green Dot Corp |
| UWMC | UWM Holdings Corp |
| COOP | Mr. Cooper Group Inc |
| IIPR | Innovative Industrial Properties Inc |

#### 산업재

| 티커 | 종목명 |
|------|--------|
| GXO | GXO Logistics Inc |
| SAIA | Saia Inc |
| NVT | nVent Electric PLC |
| IBP | Installed Building Products Inc |
| SITE | SiteOne Landscape Supply Inc |
| TREX | Trex Company Inc |
| WMS | Advanced Drainage Systems Inc |
| CSWI | CSW Industrials Inc |
| RBC | RBC Bearings Inc |
| BMI | Badger Meter Inc |
| FLR | Fluor Corp |
| KBR | KBR Inc |
| KTOS | Kratos Defense & Security Solutions Inc |
| CACI | CACI International Inc |
| PSN | Parsons Corp |
| DRS | Leonardo DRS Inc |
| MRCY | Mercury Systems Inc |
| BAH | Booz Allen Hamilton Holding Corp |
| ICFI | ICF International Inc |
| APOG | Apogee Enterprises Inc |
| GFF | Griffon Corp |
| MWA | Mueller Water Products Inc |
| UFPI | UFP Industries Inc |
| BCC | Boise Cascade Co |
| LPX | Louisiana-Pacific Corp |
| AZEK | AZEK Company Inc |
| LGIH | LGI Homes Inc |
| GRBK | Green Brick Partners Inc |
| TMHC | Taylor Morrison Home Corp |
| MHO | M/I Homes Inc |
| SKY | Skyline Champion Corp |
| CVCO | Cavco Industries Inc |
| KNX | Knight-Swift Transportation Holdings |
| RXO | RXO Inc |
| HUBG | Hub Group Inc |
| MATX | Matson Inc |
| R | Ryder System Inc |
| J | Jacobs Solutions Inc |
| EXPO | Exponent Inc |
| ACA | Arcosa Inc |
| RUSHA | Rush Enterprises Inc |
| HERC | Herc Holdings Inc |
| LBRT | Liberty Energy Inc |
| PTEN | Patterson-UTI Energy Inc |
| OII | Oceaneering International Inc |
| TDW | Tidewater Inc |
| GEO | GEO Group Inc |
| CXW | CoreCivic Inc |
| GATX | GATX Corp |
| NE | Noble Corp PLC |
| ASGN | ASGN Inc |
| KFY | Korn Ferry |
| MAN | ManpowerGroup Inc |
| KFRC | Kforce Inc |

#### 에너지

| 티커 | 종목명 |
|------|--------|
| CIVI | Civitas Resources Inc |
| SM | SM Energy Co |
| CHRD | Chord Energy Corp |
| MUR | Murphy Oil Corp |
| SWN | Southwestern Energy Co |
| PBF | PBF Energy Inc |
| VTLE | Vital Energy Inc |
| TALO | Talos Energy Inc |
| RRC | Range Resources Corp |
| GPOR | Gulfport Energy Corp |
| CNX | CNX Resources Corp |
| MTDR | Matador Resources Co |
| CRGY | Crescent Energy Co |
| NOG | Northern Oil and Gas Inc |
| DINO | HF Sinclair Corp |
| INT | World Fuel Services Corp |
| HESM | Hess Midstream Partners LP |
| AM | Antero Midstream Corp |
| KNTK | Kinetik Holdings Inc |
| SBOW | SilverBow Resources Inc |

#### 소재

| 티커 | 종목명 |
|------|--------|
| CC | Chemours Co |
| OLN | Olin Corp |
| CRS | Carpenter Technology Corp |
| HXL | Hexcel Corp |
| IOSP | Innospec Inc |
| TROX | Tronox Holdings PLC |
| KALU | Kaiser Aluminum Corp |
| CENX | Century Aluminum Co |
| SXT | Sensient Technologies Corp |

#### 통신/미디어

| 티커 | 종목명 |
|------|--------|
| LSXMA | Liberty SiriusXM Group (Class A) |
| FWONA | Liberty Media Formula One (Class A) |
| LBTYA | Liberty Global PLC (Class A) |
| CARG | CarGurus Inc |
| IAC | IAC Inc |
| ZD | Ziff Davis Inc |
| AMCX | AMC Networks Inc |
| NXST | Nexstar Media Group Inc |
| SEAT | Vivid Seats Inc |

#### 부동산 (S&P500 미포함 REIT)

| 티커 | 종목명 |
|------|--------|
| STAG | STAG Industrial Inc |
| TRNO | Terreno Realty Corp |
| KRG | Kite Realty Group Trust |
| IRT | Independence Realty Trust |
| NHI | National Health Investors Inc |
| OHI | Omega Healthcare Investors Inc |
| SBRA | Sabra Health Care REIT Inc |
| AIV | Apartment Investment and Management Co |
| UE | Urban Edge Properties |
| ROIC | Retail Opportunity Investments Corp |
| FCPT | Four Corners Property Trust Inc |
| GTY | Getty Realty Corp |

#### 암호화폐 채굴/관련

| 티커 | 종목명 |
|------|--------|
| MARA | Marathon Digital Holdings Inc |
| RIOT | Riot Platforms Inc |
| HUT | Hut 8 Corp |
| IREN | Iris Energy Ltd |
| CORZ | Core Scientific Inc |
| CLSK | CleanSpark Inc |

> **참고**: Russell 1000은 매년 6월 FTSE Russell에 의해 재구성됨. 위 목록은 2026년 초 기준 추정이며 실제 구성종목과 일부 차이가 있을 수 있음. Russell 1000 전체 = S&P 500 전체(503종목) + 위 약 497종목.

---

## 중복 현황

### 국내 지수 간 중복

| 종목코드 | 종목명 | 코스피200 | 코스닥150 | KRX반도체 | KRX2차전지 | KRX바이오 |
|----------|--------|:---------:|:---------:|:---------:|:-----------:|:---------:|
| 005930 | 삼성전자 | ✓ | | ✓ | | |
| 000660 | SK하이닉스 | ✓ | | ✓ | | |
| 042700 | 한미반도체 | ✓ | | ✓ | | |
| 373220 | LG에너지솔루션 | ✓ | | | ✓ | |
| 006400 | 삼성SDI | ✓ | | | ✓ | |
| 096770 | SK이노베이션 | ✓ | | | ✓ | |
| 051910 | LG화학 | ✓ | | | ✓ | |
| 003670 | 포스코퓨처엠 | ✓ | | | ✓ | |
| 066970 | 엘앤에프 | ✓ | | | ✓ | |
| 361610 | SK아이이테크놀로지 | ✓ | | | ✓ | |
| 068270 | 셀트리온 | ✓ | | | | ✓ |
| 207940 | 삼성바이오로직스 | ✓ | | | | ✓ |
| 000100 | 유한양행 | ✓ | | | | ✓ |
| 326030 | SK바이오팜 | ✓ | | | | ✓ |
| 128940 | 한미약품 | ✓ | | | | ✓ |
| 086520 | 에코프로 | | ✓ | | ✓ | |
| 247540 | 에코프로비엠 | | ✓ | | ✓ | |
| 005070 | 코스모신소재 | | | | ✓ | |
| 196170 | 알테오젠 | | ✓ | | | ✓ |
| 028300 | HLB | | ✓ | | | ✓ |
| 141080 | 리가켐바이오 | | ✓ | | | ✓ |
| 298380 | 에이비엘바이오 | | ✓ | | | ✓ |
| 087010 | 펩트론 | | ✓ | | | ✓ |
| 058470 | 리노공업 | | ✓ | ✓ | | |
| 240810 | 원익IPS | | ✓ | ✓ | | |
| 039030 | 이오테크닉스 | | ✓ | ✓ | | |
| 095340 | ISC | | ✓ | ✓ | | |
| 319660 | 피에스케이 | | ✓ | ✓ | | |
| 403870 | HPSP | | ✓ | ✓ | | |
| 067310 | 하나마이크론 | | ✓ | ✓ | | |
| 082270 | 젬백스 | | ✓ | ✓ | | |
| 064760 | 티씨케이 | | ✓ | ✓ | | |
| 101490 | 에스앤에스텍 | | ✓ | ✓ | | |
| 222800 | 심텍 | | ✓ | ✓ | | |
| 131970 | 두산테스나 | | ✓ | ✓ | | |
| 084370 | 유진테크 | | ✓ | ✓ | | |
| 218410 | RFHIC | | ✓ | ✓ | | |
| 098460 | 고영 | | ✓ | ✓ | | |
| 089030 | 테크윙 | | ✓ | ✓ | | |
| 166090 | 하나머티리얼즈 | | ✓ | ✓ | | |
| 183300 | 코미코 | | ✓ | ✓ | | |
| 036810 | 에프에스티 | | ✓ | ✓ | | |
| 036930 | 주성엔지니어링 | | ✓ | ✓ | | |
| 080220 | 제주반도체 | | ✓ | ✓ | | |
| 232140 | 와이씨 | | ✓ | ✓ | | |
| 348210 | 넥스틴 | | ✓ | ✓ | | |
| 046890 | 서울반도체 | | ✓ | ✓ | | |
| 213420 | 덕산네오룩스 | | ✓ | ✓ | | |
| 272290 | 이녹스첨단소재 | | ✓ | ✓ | | |
| 399720 | 가온칩스 | | ✓ | ✓ | | |
| 036540 | SFA반도체 | | ✓ | ✓ | | |

### 미국 지수 간 중복

- **나스닥100 ∩ S&P500**: 72종목 (나스닥100 101개 중 약 72개)
- **나스닥100 단독** (S&P500 미포함): 약 29종목 (ASML, SHOP, ARM, PDD, MELI, MRVL, FER, MSTR, ALNY, CCEP, TRI, INSM, ZS, TEAM 등)

---

## 유니크 종목 통계

### 국내

| 지수 | 총 종목수 | 중복 제외 순증 |
|------|---------|-------------|
| 코스피200 | 200 | 200 |
| 코스닥150 | 150 | 150 |
| KRX 반도체 | 50 | ~3 (코스피200·코스닥150 미포함 종목) |
| KRX 2차전지 TOP10 | 10 | 1 (코스모신소재 005070) |
| KRX 바이오 TOP10 | 10 | 0 (전 종목이 코스피200 또는 코스닥150 포함) |

- **국내 합계 (중복 제거 전)**: 420개
- **국내 합계 (중복 제거 후 추정)**: 약 **354개**
  - 코스피200(200) + 코스닥150(150) + KRX반도체 단독(~3) + KRX2차전지 단독(1) + KRX바이오 단독(0)
  - = 354종목

> **참고**: KRX 반도체 지수에서 코스피200, 코스닥150 모두에 포함되지 않는 종목(단독 종목)은 DB하이텍(000990), 엘비세미콘(032580), 인텍플러스(064290), 파두(440110), 이녹스(009420) 등 약 3~5개로 추정됩니다.

### 미국

| 지수 | 총 종목수 | 중복 제외 순증 |
|------|---------|-------------|
| S&P 500 | 504 | 504 |
| 나스닥 100 | 101 | 29 (S&P500 미포함) |

- **미국 합계 (중복 제거 전)**: 605개
- **미국 합계 (중복 제거 후)**: **533개**
  - S&P500(504) + 나스닥100 단독(29) = 533종목

### 전체 종목 수

| 구분 | 유니크 종목수 |
|------|------------|
| 국내 전체 | ~354종목 |
| 미국 전체 | ~533종목 |
| **합계 (국내+미국)** | **~887종목** |

---

## 데이터 출처 및 주의사항

- **코스피200**: RISE 200 ETF 구성종목 기준 (KB자산운용, 2026-03-30)
- **코스닥150**: RISE 코스닥150 ETF 구성종목 기준 (KB자산운용, 2026-03-30)
- **KRX 반도체**: KODEX 반도체 ETF + Investing.com KRX Semiconductor Components 기준
- **KRX 2차전지 TOP10**: TIGER 2차전지TOP10 ETF + 헤럴드경제 기사 기준
- **KRX 바이오 TOP10**: TIGER 바이오TOP10 ETF (364970) 기준
- **S&P 500**: topforeignstocks.com (504종목, 2026-03-30)
- **나스닥100**: stockanalysis.com (101종목, 2026-03-30)

> 지수 구성종목은 정기 변경(연 2회)이 있으므로, 최신 데이터는 한국거래소(data.krx.co.kr) 또는 각 운용사 공식 홈페이지에서 확인하세요.

---

## 추가 예정 지수 (2026-04-05)

### 1순위: Dow Jones 30 (다우존스 산업평균지수)

> **신규 스캔 종목: 0개** — 30종목 전원이 이미 S&P500에 포함되어 있음. 문서화 목적으로만 기재.

| 티커 | 종목명 |
|------|--------|
| AAPL | Apple |
| AMGN | Amgen |
| AXP | American Express |
| BA | Boeing |
| CAT | Caterpillar |
| CRM | Salesforce |
| CSCO | Cisco Systems |
| CVX | Chevron |
| DIS | Walt Disney |
| DOW | Dow Inc. |
| GS | Goldman Sachs |
| HD | Home Depot |
| HON | Honeywell |
| IBM | IBM |
| INTC | Intel |
| JNJ | Johnson & Johnson |
| JPM | JPMorgan Chase |
| KO | Coca-Cola |
| MCD | McDonald's |
| MMM | 3M |
| MRK | Merck |
| MSFT | Microsoft |
| NKE | Nike |
| PG | Procter & Gamble |
| SHW | Sherwin-Williams |
| TRV | Travelers Companies |
| UNH | UnitedHealth Group |
| V | Visa |
| VZ | Verizon |
| WMT | Walmart |

**추가 근거**: 미국 대표 우량주 30종목. BUY 신호 시 신뢰도가 높고 변동성이 낮아 안정적인 매매 환경 제공. 단, 전원 SP500 중복이므로 스캔 종목 수 변화 없음.

---

### 2순위: KRX 바이오 (국내 바이오/제약 추가 종목)

> **신규 스캔 종목: 17개** — 코스피200·코스닥150 미포함 종목만 선별 (ETF 기반)

| 종목코드 | 종목명 |
|----------|--------|
| 170900 | 동아에스티 |
| 067630 | HLB생명과학 |
| 019170 | 신풍제약 |
| 007570 | 일양약품 |
| 000020 | 동화약품 |
| 003850 | 보령 |
| 003520 | 영진약품 |
| 001060 | JW중외제약 |
| 011040 | 경동제약 |
| 034060 | 조아제약 |
| 017180 | 명인제약 |
| 220100 | 제테마 |
| 048530 | 인트론바이오 |
| 064550 | 바이오니아 |
| 011000 | 진원생명과학 |
| 299660 | 셀리드 |
| 095700 | 제넥신 |

**추가 근거**: 국내 바이오/제약 섹터는 임상 결과, 허가 이슈 등으로 급등락이 잦아 BUY 신호 포착 시 수익 기회가 큼. KRX 바이오 TOP10 ETF 외 중형 바이오주 커버리지 강화.

---

### 3순위: Russell 2000 큐레이션 (미국 중소형 성장주)

> **신규 스캔 종목: 118개** — SP500·나스닥100·Russell1000 기존 등록 종목 제외 후 섹터별 선별

#### Tech SaaS (15개)
| 티커 | 설명 |
|------|------|
| APPF | AppFolio — 부동산 관리 SaaS |
| BLKB | Blackbaud — 비영리 SaaS |
| COUR | Coursera — 온라인 교육 플랫폼 |
| CSGS | CSG Systems — 통신 빌링 SaaS |
| EVTC | EVERTEC — 중남미 결제 플랫폼 |
| FOUR | Shift4 Payments — 결제 솔루션 |
| GSHD | Goosehead Insurance — 보험 플랫폼 |
| HLIT | Harmonic — 비디오 스트리밍 인프라 |
| INST | Instructure — LMS 플랫폼 |
| MNTV | Momentive — 설문조사 SaaS |
| PCOR | Procore — 건설 프로젝트 관리 SaaS |
| RELY | Remitly — 국제 송금 플랫폼 |
| RPAY | Repay Holdings — 결제 기술 |
| WEAV | Weave Communications — 의료 커뮤니케이션 SaaS |
| XPOF | Xponential Fitness — 피트니스 프랜차이즈 |

#### 반도체/하드웨어 (8개)
| 티커 | 설명 |
|------|------|
| AEHR | Aehr Test Systems — 반도체 테스트 장비 |
| AXTI | AXT Inc. — 반도체 기판 소재 |
| CALX | Calix — 광대역 클라우드 플랫폼 |
| CLFD | Clearfield — 광섬유 네트워크 장비 |
| IDCC | InterDigital — 무선 기술 특허 |
| PLAB | Photronics — 포토마스크 |
| QLYS | Qualys — 클라우드 보안 플랫폼 |
| WOLF | Wolfspeed — SiC 전력반도체 |

#### 헬스케어/바이오테크 (44개)
| 티커 | 티커 | 티커 | 티커 |
|------|------|------|------|
| ADMA | AKRO | ALKS | AMPH |
| ANIP | ATRC | AVNS | BBIO |
| CNMD | DVAX | ENSG | ENTA |
| FLGT | HRMY | IDYA | INVA |
| IOVA | ITCI | LGND | LMAT |
| LXRX | MDXG | MRVI | NARI |
| OCUL | OPCH | PCRX | RCUS |
| RDNT | RLAY | RVNC | RYTM |
| SANA | SIGA | SILK | SPRY |
| SRPT | STAA | SUPN | THRM |
| TMDX | URGN | VCEL | VREX |

#### 금융 (14개)
| 티커 | 설명 |
|------|------|
| CHCO | City Holding — 지역 은행 |
| HURN | Huron Consulting — 경영 컨설팅 |
| KELYA | Kelly Services — 인력 파견 |
| MGRC | McGrath RentCorp — 장비 렌탈 |
| MNRO | Monro — 자동차 서비스 |
| PFBC | Preferred Bank — 캘리포니아 지역은행 |
| QCRH | QCR Holdings — 지역 은행 |
| SASR | Sandy Spring Bancorp — 지역 은행 |
| SBCF | Seacoast Banking — 플로리다 지역은행 |
| SFNC | Simmons Financial — 지역 은행 |
| SNEX | StoneX Group — 금융 서비스 |
| TOWN | Townebank — 지역 은행 |
| TRMK | Trustmark — 지역 은행 |
| WAFD | Washington Federal — 지역 은행 |

#### 산업/운송/소재 (30개)
| 티커 | 설명 |
|------|------|
| ACHR | Archer Aviation — 전기 항공 모빌리티 |
| AGX | Argan — 전력 플랜트 건설 |
| ALGT | Allegiant Travel — 저비용 항공사 |
| ARCB | ArcBest — 화물 운송 |
| ASTE | Astec Industries — 도로건설 장비 |
| ATSG | Air Transport Services — 화물 항공 |
| BCPC | Balchem — 특수 화학 |
| BRC | Brady — 산업용 라벨/표시 |
| CABO | Cable One — 케이블/인터넷 서비스 |
| CECO | CECO Environmental — 환경 설비 |
| CMCO | Columbus McKinnon — 호이스트/리프팅 |
| DAN | Dana Inc. — 차량 부품 |
| DNOW | NOW Inc. — 산업용 공급망 |
| DXPE | DXP Enterprises — 산업 유통 |
| EPC | Edgewell Personal Care — 소비재 |
| ESE | ESCO Technologies — 유틸리티 솔루션 |
| FWRD | Forward Air — 항공 화물 운송 |
| HLIO | Helios Technologies — 유압 솔루션 |
| HSII | Heidrick & Struggles — 임원 채용 |
| HWKN | Hawkins — 화학 유통 |
| JOBY | Joby Aviation — 전기 에어택시 |
| LOPE | Grand Canyon Education — 고등교육 |
| MBUU | Malibu Boats — 레저 보트 |
| MYRG | MYR Group — 전기 건설 |
| POWL | Powell Industries — 전기 배전 장비 |
| RCII | Rent-A-Center — 가전 렌탈 |
| ROCK | Gibraltar Industries — 건설 자재 |
| SMPL | Simply Good Foods — 건강식품 |
| STRL | Sterling Infrastructure — 인프라 건설 |
| SPTN | SpartanNash — 식료품 유통 |

#### 우주/크립토 인프라 (6개)
| 티커 | 설명 |
|------|------|
| CIFR | Cipher Mining — 비트코인 채굴 |
| IONQ | IonQ — 양자 컴퓨팅 |
| LUNR | Intuitive Machines — 달 탐사 |
| RKLB | Rocket Lab — 소형 로켓 발사 |
| SPCE | Virgin Galactic — 우주 관광 |
| SPIR | Spire Global — 위성 데이터 |

**추가 근거**: Russell 2000 내 성장성 높은 중소형주는 모멘텀 장세에서 SP500 대비 초과 수익 가능. 헬스케어/바이오 섹터 비중이 높아 임상 이벤트 시 급등 포착 유리. 우주/양자컴퓨팅 등 테마주 커버리지 확보.

---

### 추가 후 스캔 종목 수 변화

| 구분 | 기존 | 추가 | 변화 |
|------|------|------|------|
| 국내 전체 | ~354종목 | +17 (KRX바이오) | **~371종목** |
| 미국 전체 | ~533종목 | +118 (Russell2000) | **~651종목** |
| **합계** | **~887종목** | **+135** | **~1,022종목** |

---

## 추가: ETF 종목 (2026-04-06)

> **추가 배경**: 차트 BUY 신호 스캔 시 거래량 필터 도입 검토 중 ETF 종목이 스캔 대상에 거의 없음을 확인.
> 지수/원자재/채권 ETF는 거래량이 안정적이고 BUY 신호의 신뢰도가 높아 스캔 대상 추가 필요.
> 국내 ETF는 KRX 시총 기준, 미국 ETF는 AUM(운용자산) 기준 상위 목록.

---

### 국내 ETF 시총 상위 (약 200개)

> 출처: KRX 공시, 각 운용사 홈페이지 기준 (2026-04-06)
> yfinance 조회 시 `.KS` (KOSPI 상장) 접미사 사용

#### KODEX 계열 (삼성자산운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 069500 | KODEX 200 | 국내지수 |
| 122630 | KODEX 레버리지 | 국내지수 레버리지 |
| 114800 | KODEX 인버스 | 국내지수 인버스 |
| 252670 | KODEX 200선물인버스2X | 국내지수 인버스 |
| 229200 | KODEX 코스닥150 | 국내지수 |
| 233740 | KODEX 코스닥150레버리지 | 국내지수 레버리지 |
| 251340 | KODEX 코스닥150선물인버스 | 국내지수 인버스 |
| 266370 | KODEX 코스피 | 국내지수 |
| 278540 | KODEX MSCI Korea TR | 국내지수 |
| 213630 | KODEX 배당성장 | 국내지수 |
| 277630 | KODEX 200가치저변동 | 국내지수 |
| 153130 | KODEX 단기채권 | 채권 |
| 273130 | KODEX 종합채권(AA-이상)액티브 | 채권 |
| 385560 | KODEX 단기채권PLUS | 채권 |
| 136340 | KODEX 국고채3년 | 채권 |
| 130730 | KODEX 국고채10년 | 채권 |
| 152380 | KODEX 국고채30년 | 채권 |
| 280930 | KODEX 미국채울트라30년선물(H) | 채권 |
| 381180 | KODEX 미국채10년선물 | 채권 |
| 302190 | KODEX 미국하이일드(합성H) | 채권 |
| 272580 | KODEX iShares미국투자등급회사채(H) | 채권 |
| 458760 | KODEX 미국30년국채커버드콜(합성) | 채권 |
| 302430 | KODEX 미국S&P500배당귀족(H) | 해외지수 |
| 143850 | KODEX S&P500 | 해외지수 |
| 379800 | KODEX 미국S&P500TR | 해외지수 |
| 133690 | KODEX 나스닥100 | 해외지수 |
| 368590 | RISE 미국나스닥100 | 해외지수 |
| 409820 | KODEX 미국나스닥100레버리지(합성) | 해외지수 레버리지 |
| 251350 | KODEX 선진국MSCI World | 해외지수 |
| 195930 | KODEX 유럽 | 해외지수 |
| 200030 | KODEX 차이나A50 | 해외지수 |
| 192090 | KODEX 일본TOPIX100 | 해외지수 |
| 308620 | KODEX 미국달러선물 | 원자재/통화 |
| 261220 | KODEX WTI원유선물(H) | 원자재 |
| 132030 | KODEX 골드선물(H) | 원자재 |
| 411060 | KODEX 골드(현물) | 원자재 |
| 228790 | KODEX 은선물(H) | 원자재 |
| 176950 | KODEX 구리선물(H) | 원자재 |
| 394670 | KODEX 반도체 | 국내섹터 |
| 091160 | KODEX 반도체(구) | 국내섹터 |
| 091170 | KODEX 은행 | 국내섹터 |
| 245340 | KODEX 헬스케어 | 국내섹터 |
| 244620 | KODEX 필수소비재 | 국내섹터 |
| 244660 | KODEX 에너지화학 | 국내섹터 |
| 441800 | KODEX 미국반도체MV | 해외섹터 |
| 390390 | KODEX 미국빅테크10 | 해외테마 |
| 448290 | KODEX 미국AI테크TOP10 | 해외테마 |
| 438900 | KODEX 미국AI테크INDXX | 해외테마 |

#### TIGER 계열 (미래에셋자산운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 139260 | TIGER 200 | 국내지수 |
| 226490 | TIGER 코스닥150 | 국내지수 |
| 232080 | TIGER 코스닥150레버리지 | 국내지수 레버리지 |
| 251600 | TIGER 코스닥150선물인버스 | 국내지수 인버스 |
| 219480 | TIGER 200선물인버스 | 국내지수 인버스 |
| 329200 | TIGER 200선물인버스2X | 국내지수 인버스 |
| 248270 | TIGER 코스피 | 국내지수 |
| 272560 | TIGER 코스피고배당 | 국내지수 |
| 463050 | TIGER 200동일가중 | 국내지수 |
| 102110 | TIGER 200IT | 국내섹터 |
| 102970 | TIGER 200금융 | 국내섹터 |
| 091230 | TIGER 헬스케어 | 국내섹터 |
| 305540 | TIGER 2차전지테마 | 국내테마 |
| 352560 | TIGER Fn바이오헬스케어 | 국내섹터 |
| 130680 | TIGER 국고채3년 | 채권 |
| 148020 | TIGER 국고채10년 | 채권 |
| 182480 | TIGER 단기채권액티브 | 채권 |
| 211560 | TIGER 미국달러단기채권액티브 | 채권 |
| 189400 | TIGER 부동산인프라채권TR(H) | 채권 |
| 305080 | TIGER 미국나스닥100 | 해외지수 |
| 360750 | TIGER 미국S&P500 | 해외지수 |
| 381170 | TIGER 미국S&P500TR | 해외지수 |
| 396520 | TIGER 미국S&P500배당귀족 | 해외지수 |
| 423160 | TIGER 미국S&P500레버리지(합성) | 해외지수 레버리지 |
| 423170 | TIGER 미국나스닥100레버리지(합성) | 해외지수 레버리지 |
| 442580 | TIGER 미국배당+7%프리미엄다우존스 | 해외테마 |
| 458730 | TIGER 미국나스닥100+15%프리미엄 | 해외테마 |
| 195970 | TIGER 유로스탁스50(합성H) | 해외지수 |
| 195980 | TIGER 일본니케이225(H) | 해외지수 |
| 192720 | TIGER 차이나CSI300 | 해외지수 |
| 267980 | TIGER 원유선물Enhanced(H) | 원자재 |
| 139230 | TIGER 구리실물 | 원자재 |
| 319660 | TIGER 금은선물(H) | 원자재 |
| 441680 | TIGER 미국AI반도체핵심공정 | 해외테마 |
| 395160 | TIGER 미국필라델피아반도체나스닥 | 해외섹터 |
| 371460 | TIGER 미국테크TOP10INDXX | 해외테마 |
| 371450 | TIGER 글로벌혁신블루칩TOP10 | 해외테마 |
| 448540 | TIGER 미국S&P500배당귀족 | 해외지수 |

#### KBSTAR 계열 (KB자산운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 294400 | KBSTAR 200 (= RISE 200, 2024.07 통합) | 국내지수 |
| 270810 | KBSTAR 코스닥150 | 국내지수 |
| 315270 | KBSTAR 200선물인버스2X | 국내지수 인버스 |
| 290080 | KBSTAR 200고배당 | 국내지수 |
| 334700 | KBSTAR 단기통안채 | 채권 |
| 385720 | KBSTAR 국고채30년액티브 | 채권 |
| 360200 | KBSTAR 미국나스닥100 | 해외지수 |
| 361580 | KBSTAR 미국S&P500 | 해외지수 |
| 453810 | KBSTAR 미국배당킹 | 해외테마 |

#### RISE 계열 (KB자산운용, 구 KBSTAR 일부 통합)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 298770 | RISE 코스닥150 | 국내지수 |
| 438330 | RISE 코스피고배당50 | 국내지수 |
| 385510 | RISE 단기통안채액티브 | 채권 |
| 385540 | RISE 단기채권액티브 | 채권 |
| 379780 | RISE 미국S&P500 | 해외지수 |
| 445090 | RISE 미국S&P500TR | 해외지수 |
| 488290 | RISE 미국나스닥100TR | 해외지수 |

#### ACE 계열 (한국투자신탁운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 261240 | ACE 200 | 국내지수 |
| 278470 | ACE 코스닥150 | 국내지수 |
| 400580 | ACE 미국S&P500 | 해외지수 |
| 367380 | ACE 미국나스닥100 | 해외지수 |
| 449450 | ACE 미국S&P500TR | 해외지수 |
| 466940 | ACE 미국나스닥100TR | 해외지수 |
| 402970 | ACE 미국배당다우존스 | 해외지수 |
| 449770 | ACE 미국S&P500배당귀족 | 해외지수 |
| 381620 | ACE 미국빅테크TOP7Plus | 해외테마 |
| 468380 | ACE 미국AI인프라 | 해외테마 |

#### HANARO 계열 (NH아문디자산운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 157450 | HANARO 200 | 국내지수 |
| 245710 | HANARO 코스닥150 | 국내지수 |
| 469150 | HANARO 200동일가중 | 국내지수 |
| 336160 | HANARO 단기통안채액티브 | 채권 |
| 432840 | HANARO 미국S&P500 | 해외지수 |

#### SOL 계열 (신한자산운용)

| 종목코드 | 종목명 | 분류 |
|----------|--------|------|
| 433330 | SOL 미국S&P500 | 해외지수 |
| 476030 | SOL 미국나스닥100 | 해외지수 |
| 446720 | SOL 미국배당다우존스 | 해외지수 |
| 472160 | SOL 미국빅테크TOP7 | 해외테마 |

---

### 미국 ETF AUM 상위 (약 200개)

> 출처: ETF.com, BlackRock, Vanguard, SSGA 공시 기준 (2026-04-06)
> AUM 기준 내림차순 정렬 (대략적 순서)

#### 미국 주요 지수 ETF (S&P500/전체시장/다우/러셀)

| 티커 | ETF명 | 분류 |
|------|-------|------|
| SPY | SPDR S&P 500 ETF Trust | 미국지수 |
| IVV | iShares Core S&P 500 ETF | 미국지수 |
| VOO | Vanguard S&P 500 ETF | 미국지수 |
| QQQ | Invesco QQQ Trust | 미국지수 |
| VTI | Vanguard Total Stock Market ETF | 미국지수 |
| QQQM | Invesco Nasdaq 100 ETF | 미국지수 |
| DIA | SPDR Dow Jones Industrial Average ETF Trust | 미국지수 |
| RSP | Invesco S&P 500 Equal Weight ETF | 미국지수 |
| OEF | iShares S&P 100 ETF | 미국지수 |
| IWM | iShares Russell 2000 ETF | 미국지수 |
| IWB | iShares Russell 1000 ETF | 미국지수 |
| IWF | iShares Russell 1000 Growth ETF | 미국지수 |
| IWD | iShares Russell 1000 Value ETF | 미국지수 |
| IWN | iShares Russell 2000 Value ETF | 미국지수 |
| IWO | iShares Russell 2000 Growth ETF | 미국지수 |
| VUG | Vanguard Growth ETF | 미국지수 |
| VTV | Vanguard Value ETF | 미국지수 |
| VB | Vanguard Small-Cap ETF | 미국지수 |
| VO | Vanguard Mid-Cap ETF | 미국지수 |
| MDY | SPDR S&P MidCap 400 ETF Trust | 미국지수 |
| IJH | iShares Core S&P Mid-Cap ETF | 미국지수 |
| IJR | iShares Core S&P Small-Cap ETF | 미국지수 |
| SCHD | Schwab U.S. Dividend Equity ETF | 미국지수 |
| VYM | Vanguard High Dividend Yield ETF | 미국지수 |
| VIG | Vanguard Dividend Appreciation ETF | 미국지수 |
| DVY | iShares Select Dividend ETF | 미국지수 |
| HDV | iShares Core High Dividend ETF | 미국지수 |
| NOBL | ProShares S&P 500 Dividend Aristocrats ETF | 미국지수 |
| DGRO | iShares Core Dividend Growth ETF | 미국지수 |
| DGRW | WisdomTree U.S. Quality Dividend Growth Fund | 미국지수 |
| JEPI | JPMorgan Equity Premium Income ETF | 미국지수 |
| JEPQ | JPMorgan Nasdaq Equity Premium Income ETF | 미국지수 |
| XYLD | Global X S&P 500 Covered Call ETF | 미국지수 |
| QYLD | Global X Nasdaq 100 Covered Call ETF | 미국지수 |
| QUAL | iShares MSCI USA Quality Factor ETF | 미국지수 |
| MTUM | iShares MSCI USA Momentum Factor ETF | 미국지수 |
| USMV | iShares MSCI USA Min Vol Factor ETF | 미국지수 |
| VLUE | iShares MSCI USA Value Factor ETF | 미국지수 |
| SPHQ | Invesco S&P 500 Quality ETF | 미국지수 |
| SCHB | Schwab U.S. Broad Market ETF | 미국지수 |
| SCHX | Schwab U.S. Large-Cap ETF | 미국지수 |
| SCHA | Schwab U.S. Small-Cap ETF | 미국지수 |
| VBR | Vanguard Small-Cap Value ETF | 미국지수 |
| VBK | Vanguard Small-Cap Growth ETF | 미국지수 |
| VOE | Vanguard Mid-Cap Value ETF | 미국지수 |
| VOT | Vanguard Mid-Cap Growth ETF | 미국지수 |

#### 채권 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| AGG | iShares Core U.S. Aggregate Bond ETF | 채권 |
| BND | Vanguard Total Bond Market ETF | 채권 |
| TLT | iShares 20+ Year Treasury Bond ETF | 채권 |
| IEF | iShares 7-10 Year Treasury Bond ETF | 채권 |
| SHY | iShares 1-3 Year Treasury Bond ETF | 채권 |
| LQD | iShares iBoxx $ Investment Grade Corporate Bond ETF | 채권 |
| HYG | iShares iBoxx $ High Yield Corporate Bond ETF | 채권 |
| JNK | SPDR Bloomberg High Yield Bond ETF | 채권 |
| MUB | iShares National Muni Bond ETF | 채권 |
| TIP | iShares TIPS Bond ETF | 채권 |
| BNDX | Vanguard Total International Bond ETF | 채권 |
| VCIT | Vanguard Intermediate-Term Corporate Bond ETF | 채권 |
| VCSH | Vanguard Short-Term Corporate Bond ETF | 채권 |
| BSV | Vanguard Short-Term Bond ETF | 채권 |
| BIV | Vanguard Intermediate-Term Bond ETF | 채권 |
| VGSH | Vanguard Short-Term Treasury ETF | 채권 |
| VGIT | Vanguard Intermediate-Term Treasury ETF | 채권 |
| VGLT | Vanguard Long-Term Treasury ETF | 채권 |
| GOVT | iShares U.S. Treasury Bond ETF | 채권 |
| SHV | iShares Short Treasury Bond ETF | 채권 |
| SGOV | iShares 0-3 Month Treasury Bond ETF | 채권 |
| BIL | SPDR Bloomberg 1-3 Month T-Bill ETF | 채권 |
| USFR | WisdomTree Floating Rate Treasury ETF | 채권 |
| FLOT | iShares Floating Rate Bond ETF | 채권 |
| IGSB | iShares Short-Term Corporate Bond ETF | 채권 |
| IGIB | iShares Intermediate-Term Corporate Bond ETF | 채권 |
| IGLB | iShares Long-Term Corporate Bond ETF | 채권 |
| EMB | iShares J.P. Morgan USD Emerging Markets Bond ETF | 채권 |
| SPTL | SPDR Portfolio Long Term Treasury ETF | 채권 |
| IEI | iShares 3-7 Year Treasury Bond ETF | 채권 |
| TMF | Direxion Daily 20+ Yr Treasury Bull 3X Shares | 채권 레버리지 |
| TBT | ProShares UltraShort 20+ Year Treasury | 채권 인버스 |
| TBF | ProShares Short 20+ Year Treasury | 채권 인버스 |
| TMV | Direxion Daily 20+ Yr Treasury Bear 3X Shares | 채권 인버스 |

#### 원자재 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| GLD | SPDR Gold Shares | 금 |
| IAU | iShares Gold Trust | 금 |
| GLDM | SPDR Gold MiniShares Trust | 금 |
| UGL | ProShares Ultra Gold | 금 레버리지 |
| GDX | VanEck Gold Miners ETF | 금광주 |
| GDXJ | VanEck Junior Gold Miners ETF | 금광주 |
| SLV | iShares Silver Trust | 은 |
| SIVR | Aberdeen Standard Physical Silver Shares ETF | 은 |
| SIL | Global X Silver Miners ETF | 은광주 |
| PPLT | Aberdeen Standard Physical Platinum Shares ETF | 백금 |
| PALL | Aberdeen Standard Physical Palladium Shares ETF | 팔라듐 |
| USO | United States Oil Fund | 원유 |
| BNO | United States Brent Oil Fund | 원유 |
| UCO | ProShares Ultra Bloomberg Crude Oil | 원유 레버리지 |
| DBO | Invesco DB Oil Fund | 원유 |
| UNG | United States Natural Gas Fund | 천연가스 |
| BOIL | ProShares Ultra Bloomberg Natural Gas | 천연가스 레버리지 |
| KOLD | ProShares UltraShort Bloomberg Natural Gas | 천연가스 인버스 |
| CPER | United States Copper Index Fund | 구리 |
| COPX | Global X Copper Miners ETF | 구리광주 |
| REMX | VanEck Rare Earth/Strategic Metals ETF | 희토류 |
| URA | Global X Uranium ETF | 우라늄 |
| DBA | Invesco DB Agriculture Fund | 농산물 |
| WEAT | Teucrium Wheat Fund | 밀 |
| CORN | Teucrium Corn Fund | 옥수수 |
| SOYB | Teucrium Soybean Fund | 대두 |
| MOO | VanEck Agribusiness ETF | 농업 |
| DBC | Invesco DB Commodity Index Tracking Fund | 원자재복합 |
| PDBC | Invesco Optimum Yield Diversified Commodity | 원자재복합 |
| GSG | iShares S&P GSCI Commodity-Indexed Trust | 원자재복합 |
| GNR | SPDR S&P Global Natural Resources ETF | 천연자원 |
| WOOD | iShares Global Timber & Forestry ETF | 목재 |

#### 섹터 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| XLK | Technology Select Sector SPDR Fund | 기술 |
| XLF | Financial Select Sector SPDR Fund | 금융 |
| XLE | Energy Select Sector SPDR Fund | 에너지 |
| XLV | Health Care Select Sector SPDR Fund | 헬스케어 |
| XLY | Consumer Discretionary Select Sector SPDR Fund | 소비재(경기) |
| XLP | Consumer Staples Select Sector SPDR Fund | 소비재(필수) |
| XLB | Materials Select Sector SPDR Fund | 소재 |
| XLI | Industrials Select Sector SPDR Fund | 산업재 |
| XLU | Utilities Select Sector SPDR Fund | 유틸리티 |
| XLRE | Real Estate Select Sector SPDR Fund | 부동산 |
| XLC | Communication Services Select Sector SPDR Fund | 통신 |
| VGT | Vanguard Information Technology ETF | 기술 |
| VHT | Vanguard Health Care ETF | 헬스케어 |
| VFH | Vanguard Financials ETF | 금융 |
| VDE | Vanguard Energy ETF | 에너지 |
| VCR | Vanguard Consumer Discretionary ETF | 소비재(경기) |
| VDC | Vanguard Consumer Staples ETF | 소비재(필수) |
| VPU | Vanguard Utilities ETF | 유틸리티 |
| VOX | Vanguard Communication Services ETF | 통신 |
| SOXX | iShares Semiconductor ETF | 반도체 |
| SMH | VanEck Semiconductor ETF | 반도체 |
| SOXL | Direxion Daily Semiconductor Bull 3X Shares | 반도체 레버리지 |
| SOXS | Direxion Daily Semiconductor Bear 3X Shares | 반도체 인버스 |
| IBB | iShares Biotechnology ETF | 바이오 |
| XBI | SPDR S&P Biotech ETF | 바이오 |
| IGV | iShares Expanded Tech-Software Sector ETF | 소프트웨어 |
| FTEC | Fidelity MSCI Information Technology Index ETF | 기술 |
| OIH | VanEck Oil Services ETF | 에너지서비스 |
| XOP | SPDR S&P Oil & Gas Exploration & Production ETF | 원유탐사 |
| AMLP | Alerian MLP ETF | 에너지인프라 |
| VNQ | Vanguard Real Estate ETF | 부동산 |
| IYR | iShares U.S. Real Estate ETF | 부동산 |

#### 레버리지/인버스 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| TQQQ | ProShares UltraPro QQQ | 나스닥3X |
| UPRO | ProShares UltraPro S&P 500 | S&P500 3X |
| SPXL | Direxion Daily S&P 500 Bull 3X Shares | S&P500 3X |
| SSO | ProShares Ultra S&P 500 | S&P500 2X |
| QLD | ProShares Ultra QQQ | 나스닥 2X |
| UDOW | ProShares UltraPro Dow30 | 다우 3X |
| DDM | ProShares Ultra Dow30 | 다우 2X |
| ROM | ProShares Ultra Technology | 기술 2X |
| TECL | Direxion Daily Technology Bull 3X Shares | 기술 3X |
| FAS | Direxion Daily Financial Bull 3X Shares | 금융 3X |
| TNA | Direxion Daily Small Cap Bull 3X Shares | 소형주 3X |
| SQQQ | ProShares UltraPro Short QQQ | 나스닥 -3X |
| SPXS | Direxion Daily S&P 500 Bear 3X Shares | S&P500 -3X |
| SPXU | ProShares UltraPro Short S&P500 | S&P500 -3X |
| SDOW | ProShares UltraPro Short Dow30 | 다우 -3X |
| TECS | Direxion Daily Technology Bear 3X Shares | 기술 -3X |
| FAZ | Direxion Daily Financial Bear 3X Shares | 금융 -3X |
| TZA | Direxion Daily Small Cap Bear 3X Shares | 소형주 -3X |
| SH | ProShares Short S&P 500 | S&P500 -1X |
| PSQ | ProShares Short QQQ | 나스닥 -1X |
| DOG | ProShares Short Dow30 | 다우 -1X |
| RWM | ProShares Short Russell 2000 | 러셀2000 -1X |

#### 해외 지수 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| EEM | iShares MSCI Emerging Markets ETF | 신흥국 |
| VWO | Vanguard FTSE Emerging Markets ETF | 신흥국 |
| EFA | iShares MSCI EAFE ETF | 선진국(미국제외) |
| IEFA | iShares Core MSCI EAFE ETF | 선진국(미국제외) |
| VEA | Vanguard FTSE Developed Markets ETF | 선진국(미국제외) |
| VT | Vanguard Total World Stock ETF | 전세계 |
| ACWI | iShares MSCI ACWI ETF | 전세계 |
| EWJ | iShares MSCI Japan ETF | 일본 |
| EWZ | iShares MSCI Brazil ETF | 브라질 |
| EWG | iShares MSCI Germany ETF | 독일 |
| EWY | iShares MSCI South Korea ETF | 한국 |
| EWT | iShares MSCI Taiwan ETF | 대만 |
| FXI | iShares China Large-Cap ETF | 중국 |
| KWEB | KraneShares CSI China Internet ETF | 중국인터넷 |
| MCHI | iShares MSCI China ETF | 중국 |
| INDA | iShares MSCI India ETF | 인도 |
| EWC | iShares MSCI Canada ETF | 캐나다 |
| EWU | iShares MSCI United Kingdom ETF | 영국 |

#### 테마 ETF

| 티커 | ETF명 | 분류 |
|------|-------|------|
| ARKK | ARK Innovation ETF | 혁신테마 |
| ARKG | ARK Genomic Revolution ETF | 유전체 |
| ARKW | ARK Next Generation Internet ETF | 인터넷 |
| ARKQ | ARK Autonomous Technology & Robotics ETF | 로봇/자율주행 |
| BOTZ | Global X Robotics & Artificial Intelligence ETF | AI/로봇 |
| AIQ | Global X Artificial Intelligence & Technology ETF | AI |
| ICLN | iShares Global Clean Energy ETF | 청정에너지 |
| TAN | Invesco Solar ETF | 태양광 |
| LIT | Global X Lithium & Battery Tech ETF | 리튬/배터리 |
| DRIV | Global X Autonomous & Electric Vehicles ETF | 전기차 |
| PAVE | Global X U.S. Infrastructure Development ETF | 인프라 |
| CLOU | Global X Cloud Computing ETF | 클라우드 |
| SKYY | First Trust Cloud Computing ETF | 클라우드 |
| CIBR | First Trust NASDAQ Cybersecurity ETF | 사이버보안 |
| BUG | Global X Cybersecurity ETF | 사이버보안 |
| NLR | VanEck Uranium+Nuclear Energy ETF | 원자력 |
| IBIT | iShares Bitcoin Trust ETF | 비트코인현물 |
| FBTC | Fidelity Wise Origin Bitcoin Fund | 비트코인현물 |
| BITO | ProShares Bitcoin Strategy ETF | 비트코인선물 |
| GBTC | Grayscale Bitcoin Trust ETF | 비트코인 |
| ETHA | iShares Ethereum Trust ETF | 이더리움현물 |

---

### 꼭 추가되면 좋은 ETF 100개 추천 (국내 50 + 미국 50)

> **선정 기준**: 거래량 충분 + BUY 신호 포착 실익 + 시장 상황 반영도 + 섹터/자산 다양성

#### 국내 ETF 추천 50개

| 종목코드 | 종목명 | 분류 | 추가 이유 |
|----------|--------|------|-----------|
| 069500 | KODEX 200 | 국내지수 | 국내 최대 AUM, 코스피200 직접 추종, 거래량 안정적 |
| 122630 | KODEX 레버리지 | 국내지수 레버리지 | 상승장 BUY 신호 시 초과수익 포착, 거래량 1위권 |
| 229200 | KODEX 코스닥150 | 국내지수 | 코스닥 대표, 기술/바이오 비중 높아 상승 탄력 강함 |
| 233740 | KODEX 코스닥150레버리지 | 국내지수 레버리지 | 코스닥 강세장 BUY 신호 포착 효과 극대화 |
| 139260 | TIGER 200 | 국내지수 | KODEX 200과 함께 양대 코스피200 ETF, 유동성 풍부 |
| 226490 | TIGER 코스닥150 | 국내지수 | KODEX와 경쟁 구도로 유동성 양쪽 모두 높음 |
| 136340 | KODEX 국고채3년 | 채권 | 단기채 기준, 금리 하락 시 BUY 신호 포착 유리 |
| 152380 | KODEX 국고채30년 | 채권 | 장기채 듀레이션 높아 금리 하락 시 급등, BUY 신호 실효 큼 |
| 273130 | KODEX 종합채권(AA-이상)액티브 | 채권 | 투자등급 회사채 혼합, 채권시장 전반 모니터링 |
| 132030 | KODEX 골드선물(H) | 원자재 | 금 가격 추종, 안전자산 수요 증가 시 BUY 신호 포착 |
| 411060 | KODEX 골드(현물) | 원자재 | 현물 금 ETF, 선물 롤오버 비용 없어 장기보유 적합 |
| 228790 | KODEX 은선물(H) | 원자재 | 은 가격 추종, 산업수요+안전자산 이중 역할 |
| 261220 | KODEX WTI원유선물(H) | 원자재 | 유가 변동 직접 추종, 에너지 가격 급등 시 BUY 신호 |
| 138910 | KODEX 구리선물(H) | 원자재 | 경기 선행지표 역할, 제조업 회복 신호와 연동 |
| 091160 | KODEX 반도체 | 국내섹터 | 국내 반도체 섹터 대표, 삼성전자/SK하이닉스 외 중소형 포함 |
| 091170 | KODEX 은행 | 국내섹터 | 금리 수혜주 집합, 금리인상기 BUY 신호 효과 큼 |
| 305540 | TIGER 2차전지테마 | 국내테마 | 2차전지 테마 대표, 정책/수주 이벤트 시 급등 포착 |
| 352560 | TIGER Fn바이오헬스케어 | 국내섹터 | 바이오 섹터 대표, 임상/허가 이벤트 연동 |
| 143850 | KODEX S&P500 | 해외지수 | 미국 S&P500 원화 투자, 환헤지 없어 달러 상승 수혜 |
| 379800 | KODEX 미국S&P500TR | 해외지수 | 배당 재투자형, 장기 복리 효과 극대화 |
| 133690 | KODEX 나스닥100 | 해외지수 | 미국 기술주 집중, 나스닥 강세장 수혜 |
| 368590 | RISE 미국나스닥100 | 해외지수 | 배당 재투자형 나스닥100 추종 |
| 305080 | TIGER 미국나스닥100 | 해외지수 | KODEX와 함께 나스닥100 양대 ETF, 유동성 우수 |
| 360750 | TIGER 미국S&P500 | 해외지수 | S&P500 미래에셋 버전, AUM 급성장 중 |
| 334700 | KBSTAR 단기통안채 | 채권 | MMF 대체, 단기 자금운용 BUY 신호 포착 가능 |
| 385720 | KBSTAR 국고채30년액티브 | 채권 | 장기채 액티브 운용, 금리 하락 시 초과수익 가능 |
| 294400 | KBSTAR 200 | 국내지수 | 수수료 경쟁력, 추가 유동성 소스 |
| 400580 | ACE 미국S&P500 | 해외지수 | 한국투자 운용, S&P500 추종 4번째 ETF |
| 367380 | ACE 미국나스닥100 | 해외지수 | 다양한 운용사 나스닥100 ETF 커버리지 |
| 157450 | HANARO 200 | 국내지수 | NH아문디 코스피200, 기관 수요 중심 |
| 433330 | SOL 미국S&P500 | 해외지수 | 신한 S&P500, AUM 성장세 강함 |
| 476030 | SOL 미국나스닥100 | 해외지수 | 신한 나스닥100, 신규 자금 유입 활발 |
| 280930 | KODEX 미국채울트라30년선물(H) | 채권 | 초장기 미국채 추종, 금리 민감도 최고 |
| 302190 | KODEX 미국하이일드(합성H) | 채권 | 고수익채권 추종, 위험선호 회복 시 선제 BUY 신호 |
| 272580 | KODEX iShares미국투자등급회사채(H) | 채권 | 미국 IG 회사채, 신용 스프레드 축소 시 수혜 |
| 267980 | TIGER 원유선물Enhanced(H) | 원자재 | 원유 선물 롤오버 비용 최소화 전략 |
| 160580 | TIGER 구리실물 | 원자재 | 실물 구리 연동, 제조업 경기 선행 지표 |
| 395160 | TIGER 미국필라델피아반도체나스닥 | 해외섹터 | SOX 지수 추종, 미국 반도체 사이클 직접 포착 |
| 441680 | TIGER 미국AI반도체핵심공정 | 해외테마 | AI 반도체 테마, NVDA/ASML 등 핵심 종목 집중 |
| 130680 | TIGER 국고채3년 | 채권 | 국내 단기 기준금리 연동 ETF |
| 148020 | TIGER 국고채10년 | 채권 | 국내 10년물 추종, 장기금리 BUY 신호 포착 |
| 442580 | TIGER 미국배당+7%프리미엄다우존스 | 해외테마 | 월배당+프리미엄, 방어적 상승 포착 |
| 319660 | TIGER 금은선물(H) | 원자재 | 금+은 혼합 추종, 귀금속 전반 상승 포착 |

#### 미국 ETF 추천 50개

| 티커 | ETF명 | 분류 | 추가 이유 |
|------|-------|------|-----------|
| SPY | SPDR S&P 500 ETF Trust | 미국지수 | 세계 최대 AUM ETF, 유동성 1위, 기준점 역할 |
| QQQ | Invesco QQQ Trust | 미국지수 | 나스닥100 대표, 기술주 강세 BUY 신호 포착 필수 |
| IWM | iShares Russell 2000 ETF | 미국지수 | 소형주 대표, 위험선호 회복 선행 지표 |
| TLT | iShares 20+ Year Treasury Bond ETF | 채권 | 장기채 벤치마크, 금리 하락 시 급등 포착 핵심 |
| GLD | SPDR Gold Shares | 금 | 금 시장 대표 ETF, 안전자산 BUY 신호 포착 |
| IAU | iShares Gold Trust | 금 | GLD 대비 수수료 저렴, 장기보유 적합 |
| AGG | iShares Core U.S. Aggregate Bond ETF | 채권 | 미국 채권 시장 전반 추종, 채권 사이클 모니터링 |
| BND | Vanguard Total Bond Market ETF | 채권 | AGG와 함께 채권 시장 양대 ETF |
| LQD | iShares iBoxx $ Investment Grade Corporate Bond ETF | 채권 | 투자등급 회사채 대표, 신용 스프레드 축소 시 BUY |
| HYG | iShares iBoxx $ High Yield Corporate Bond ETF | 채권 | 하이일드 대표, 위험선호 회복 시 선제 BUY 신호 |
| XLK | Technology Select Sector SPDR Fund | 섹터 | 기술 섹터 대표, 나스닥 상승과 연동 |
| XLF | Financial Select Sector SPDR Fund | 섹터 | 금융 섹터 대표, 금리 수혜 BUY 신호 포착 |
| XLE | Energy Select Sector SPDR Fund | 섹터 | 에너지 섹터 대표, 유가 상승 시 BUY |
| XLV | Health Care Select Sector SPDR Fund | 섹터 | 헬스케어 방어 섹터, 경기침체 시 BUY 신호 빈번 |
| XLI | Industrials Select Sector SPDR Fund | 섹터 | 산업재 섹터, 경기 회복 사이클 포착 |
| SOXX | iShares Semiconductor ETF | 섹터 | 반도체 섹터 대표, 사이클 상승 BUY 신호 |
| SMH | VanEck Semiconductor ETF | 섹터 | SOXX와 함께 반도체 양대 ETF |
| TQQQ | ProShares UltraPro QQQ | 레버리지 | 나스닥 3배 레버리지, BUY 신호 시 수익 극대화 |
| UPRO | ProShares UltraPro S&P 500 | 레버리지 | S&P500 3배 레버리지 |
| SOXL | Direxion Daily Semiconductor Bull 3X Shares | 레버리지 | 반도체 3배, 반도체 강세장 집중 포착 |
| JEPI | JPMorgan Equity Premium Income ETF | 미국지수 | 월배당+커버드콜, 방어적 BUY 신호 |
| JEPQ | JPMorgan Nasdaq Equity Premium Income ETF | 미국지수 | 나스닥 기반 월배당, 기술주 방어적 노출 |
| SCHD | Schwab U.S. Dividend Equity ETF | 미국지수 | 배당성장 대표 ETF, 가치주 BUY 신호 포착 |
| VYM | Vanguard High Dividend Yield ETF | 미국지수 | 고배당주 집합, 금리 하락 시 재평가 |
| NOBL | ProShares S&P 500 Dividend Aristocrats ETF | 미국지수 | 배당귀족주, 하락장 방어+상승 복귀 BUY 포착 |
| IEF | iShares 7-10 Year Treasury Bond ETF | 채권 | 중기 국채 기준, 채권 사이클 중간 구간 |
| SHY | iShares 1-3 Year Treasury Bond ETF | 채권 | 단기채, 금리 인하 직접 수혜 |
| SGOV | iShares 0-3 Month Treasury Bond ETF | 채권 | MMF 대체, 단기 자금 피난처 BUY 신호 |
| TIP | iShares TIPS Bond ETF | 채권 | 물가연동채, 인플레이션 상승 시 BUY 신호 |
| EMB | iShares J.P. Morgan USD Emerging Markets Bond ETF | 채권 | 신흥국 채권, 달러 약세+금리 하락 시 동반 BUY |
| SLV | iShares Silver Trust | 은 | 은 가격 직접 추종, 귀금속+산업금속 이중 역할 |
| GDX | VanEck Gold Miners ETF | 금광주 | 금 가격 레버리지 효과, 금 BUY 신호 연동 |
| USO | United States Oil Fund | 원유 | 원유 직접 추종, 에너지 섹터 BUY 신호 연동 |
| DBA | Invesco DB Agriculture Fund | 농산물 | 밀/옥수수/대두 혼합, 식량 인플레이션 포착 |
| UNG | United States Natural Gas Fund | 천연가스 | 천연가스 직접 추종, 에너지 가격 독립적 사이클 |
| COPX | Global X Copper Miners ETF | 구리광주 | 구리 가격 레버리지, 글로벌 제조업 회복 선행 |
| URA | Global X Uranium ETF | 우라늄 | 원자력 르네상스 테마, 탈탄소 정책 수혜 |
| EEM | iShares MSCI Emerging Markets ETF | 신흥국 | 신흥국 대표, 달러 약세+글로벌 위험선호 BUY |
| EFA | iShares MSCI EAFE ETF | 선진국 | 미국 외 선진국 대표, 달러 약세 시 상대 강세 |
| EWJ | iShares MSCI Japan ETF | 일본 | 일본 주식 대표, 엔화+닛케이 BUY 신호 포착 |
| INDA | iShares MSCI India ETF | 인도 | 인도 성장 대표, 고성장 신흥국 BUY 신호 |
| FXI | iShares China Large-Cap ETF | 중국 | 중국 대형주 대표, 중국 경기부양 시 BUY |
| IBB | iShares Biotechnology ETF | 바이오 | 바이오테크 대표, FDA 이벤트 시 BUY 신호 빈번 |
| ARKK | ARK Innovation ETF | 혁신테마 | 성장 테마 대표, 위험선호 강세장 BUY 신호 |
| ICLN | iShares Global Clean Energy ETF | 청정에너지 | 재생에너지 테마, 정책 변화 시 BUY 신호 |
| LIT | Global X Lithium & Battery Tech ETF | 리튬/배터리 | 전기차 공급망 핵심, 배터리 사이클 포착 |
| IBIT | iShares Bitcoin Trust ETF | 비트코인현물 | 비트코인 현물 ETF 1위, 크립토 BUY 신호 연동 |
| ETHA | iShares Ethereum Trust ETF | 이더리움현물 | 이더리움 현물 ETF 대표, 크립토 포트폴리오 분산 |
| SQQQ | ProShares UltraPro Short QQQ | 인버스 | 나스닥 하락장 헤지, 시장 과열 시 매도 신호 포착 |
| VNQ | Vanguard Real Estate ETF | 부동산 | 리츠 대표 ETF, 금리 하락 시 BUY 신호 강함 |
| DBC | Invesco DB Commodity Index Tracking Fund | 원자재복합 | 원자재 전반 추종, 인플레이션 사이클 BUY |

---

### 추가 후 스캔 종목 수 변화 (ETF 추가 후)

| 구분 | 기존 | 추가 | 합계 |
|------|------|------|------|
| 국내 전체 (개별주) | ~371종목 | 0 | ~371종목 |
| 국내 ETF | 0 | ~188종목 | ~188종목 |
| 미국 전체 (개별주) | ~651종목 | 0 | ~651종목 |
| 미국 ETF | 0 | ~218종목 | ~218종목 |
| **합계** | **~1,022종목** | **~406종목 ETF 추가** | **~1,428종목** |

> **주의**: 국내 ETF는 yfinance에서 `.KS` 접미사로 대부분 조회 가능하나 일부 최신 ETF는 데이터 누락 가능.
> 미국 ETF는 yfinance 조회 안정적. 레버리지/인버스 ETF는 BUY 신호 유효기간이 짧으므로 주의.
