"""스캔 대상 종목 리스트 — 코스피200, 코스닥150, KRX 반도체/2차전지, S&P500, 나스닥100, 다우존스30, 국내/미국 ETF.

출처: .claude/docs/buy종목리스트정리.md (2026-04-12 기준)
중복 제거 후 국내 ~470종목 + 미국 ~718종목 = 총 ~1198종목
"""

# ── 코스피200 (200종목) ────────────────────────────────────────────────────────
KOSPI200_SYMBOLS: set[str] = {
    "005930", "000660", "005380", "105560", "402340", "012450", "034020", "055550",
    "000270", "068270", "035420", "086790", "028260", "006400", "012330", "009150",
    "005490", "316140", "373220", "267260", "032830", "006800", "009540", "010140",
    "035720", "042660", "329180", "207940", "051910", "033780", "000810", "030200",
    "015760", "064350", "047810", "010120", "066570", "017670", "034730", "298040",
    "267250", "042700", "000720", "010130", "079550", "138040", "071050", "096770",
    "272210", "323410", "000150", "086280", "278470", "003550", "003670", "259960",
    "005830", "352820", "003490", "000100", "011200", "039490", "024110", "018260",
    "016360", "007660", "028050", "180640", "175330", "138930", "003230", "005940",
    "006260", "010950", "011070", "090430", "032640", "066970", "036570", "021240",
    "009830", "161390", "128940", "047040", "047050", "034220", "000880", "001440",
    "241560", "271560", "004020", "064400", "052690", "078930", "001040", "010060",
    "326030", "443060", "307950", "139130", "014680", "082740", "051900", "012750",
    "017800", "035250", "009420", "004170", "002380", "375500", "450080", "457190",
    "139480", "097950", "111770", "001450", "011780", "011790", "062040", "071970",
    "088350", "022100", "011170", "006360", "112610", "103140", "251270", "192820",
    "204320", "454910", "377300", "120110", "161890", "011210", "008770", "000120",
    "004370", "017960", "036460", "029780", "030000", "081660", "051600", "069960",
    "073240", "028670", "018880", "023530", "008930", "009970", "282330", "302440",
    "298020", "383220", "361610", "185750", "007340", "007070", "006280", "005850",
    "004000", "004990", "002790", "000210", "001430", "026960", "034230", "069620",
    "001800", "000240", "000080", "003090", "004490", "007310", "006650", "192080",
    "285130", "298050", "300720", "280360", "137310", "093370", "114090", "008730",
    "005420", "006040", "009240", "005250", "005300", "002840", "003030", "000670",
    "002030", "001680", "069260", "071320", "014820", "268280",
}

# ── 코스닥150 (150종목) ────────────────────────────────────────────────────────
KOSDAQ150_SYMBOLS: set[str] = {
    "000250", "196170", "086520", "247540", "298380", "087010", "028300", "141080",
    "058470", "277810", "240810", "032820", "310210", "039030", "226950", "263750",
    "108490", "095340", "347850", "214450", "036930", "403870", "237690", "083650",
    "039200", "035900", "445680", "084370", "319660", "357780", "005290", "058610",
    "214370", "067310", "082270", "145020", "178320", "098460", "218410", "089030",
    "064760", "078600", "101490", "222800", "257720", "085660", "048410", "290650",
    "131970", "041510", "323280", "214150", "068760", "080220", "140860", "065350",
    "328130", "466100", "189300", "137400", "007390", "122870", "032500", "195940",
    "281740", "232140", "031980", "050890", "417200", "096530", "095610", "035760",
    "358570", "213420", "183300", "161580", "166090", "222080", "003380", "121600",
    "014620", "086450", "131290", "388720", "348210", "036810", "042000", "086900",
    "365340", "241710", "253450", "293490", "067160", "074600", "056080", "060280",
    "036540", "033100", "052400", "025320", "060370", "025980", "015750", "053800",
    "112040", "214430", "383310", "399720", "171090", "033500", "009520", "006730",
    "060250", "376300", "272290", "059090", "056190", "046890", "041190", "053030",
    "036620", "018290", "215200", "108860", "204270", "211050", "253590", "336570",
    "032190", "030520", "095660", "079370", "078340", "101360", "278280", "225570",
    "304100", "194480", "069080", "036830", "460930", "251970", "058970", "215000",
    "200130", "101730", "025900", "352480",
}

# ── KRX 반도체/2차전지 추가 (코스피200·코스닥150 미포함 종목) ─────────────────
# DB하이텍, 엘비세미콘, 인텍플러스, 파두, 코스모신소재
KRX_EXTRA_SYMBOLS: set[str] = {
    "000990",  # DB하이텍 (KRX 반도체, KOSPI)
    "032580",  # 엘비세미콘 (KRX 반도체, KOSDAQ)
    "064290",  # 인텍플러스 (KRX 반도체, KOSDAQ)
    "440110",  # 파두 (KRX 반도체, KOSDAQ)
    "005070",  # 코스모신소재 (KRX 2차전지 단독, KOSDAQ)
}

# ── 국내 ETF (코스피 상장 ETF, 국내지수/해외지수/채권/원자재/섹터 등) ──────────────
KR_ETF_SYMBOLS: set[str] = {
    # KODEX (삼성자산운용)
    "069500",  # KODEX 200
    "122630",  # KODEX 레버리지
    "114800",  # KODEX 인버스
    "252670",  # KODEX 200선물인버스2X
    "229200",  # KODEX 코스닥150
    "233740",  # KODEX 코스닥150레버리지
    "251340",  # KODEX 코스닥150선물인버스
    "266370",  # KODEX 코스피
    "278540",  # KODEX MSCI Korea TR
    "213630",  # KODEX 배당성장
    "277630",  # KODEX 200가치저변동
    "153130",  # KODEX 단기채권
    "273130",  # KODEX 종합채권(AA-이상)액티브
    "385560",  # KODEX 단기채권PLUS
    "136340",  # KODEX 국고채3년
    "130730",  # KODEX 국고채10년
    "152380",  # KODEX 국고채30년
    "280930",  # KODEX 미국채울트라30년선물(H)
    "381180",  # KODEX 미국채10년선물
    "302190",  # KODEX 미국하이일드(합성H)
    "272580",  # KODEX iShares미국투자등급회사채(H)
    "458760",  # KODEX 미국30년국채커버드콜(합성)
    "302430",  # KODEX 미국S&P500배당귀족(H)
    "143850",  # KODEX S&P500
    "379800",  # KODEX 미국S&P500TR
    "133690",  # KODEX 나스닥100
    "368590",  # RISE 미국나스닥100 (368590.KS)
    "409820",  # KODEX 미국나스닥100레버리지(합성)
    "251350",  # KODEX 선진국MSCI World
    "195930",  # KODEX 유럽
    "200030",  # KODEX 차이나A50
    "192090",  # KODEX 일본TOPIX100
    "308620",  # KODEX 미국달러선물
    "261220",  # KODEX WTI원유선물(H)
    "132030",  # KODEX 골드선물(H)
    "411060",  # KODEX 골드(현물)
    "228790",  # KODEX 은선물(H)
    "138910",  # KODEX 구리선물(H)
    "394670",  # KODEX 반도체
    "091160",  # KODEX 반도체(구)
    "091170",  # KODEX 은행
    "245340",  # KODEX 헬스케어
    "244620",  # KODEX 필수소비재
    "244660",  # KODEX 에너지화학
    "441800",  # KODEX 미국반도체MV
    "390390",  # KODEX 미국빅테크10
    "448290",  # KODEX 미국AI테크TOP10
    "438900",  # KODEX 미국AI테크INDXX
    # TIGER (미래에셋자산운용)
    "139260",  # TIGER 200
    "226490",  # TIGER 코스닥150
    "232080",  # TIGER 코스닥150레버리지
    "251600",  # TIGER 코스닥150선물인버스
    "219480",  # TIGER 200선물인버스
    "329200",  # TIGER 200선물인버스2X
    "248270",  # TIGER 코스피
    "272560",  # TIGER 코스피고배당
    "463050",  # TIGER 200동일가중
    "102110",  # TIGER 200IT
    "102970",  # TIGER 200금융
    "091230",  # TIGER 헬스케어
    "305540",  # TIGER 2차전지테마
    "352560",  # TIGER Fn바이오헬스케어
    "130680",  # TIGER 국고채3년
    "148020",  # TIGER 국고채10년
    "182480",  # TIGER 단기채권액티브
    "211560",  # TIGER 미국달러단기채권액티브
    "189400",  # TIGER 부동산인프라채권TR(H)
    "305080",  # TIGER 미국나스닥100
    "360750",  # TIGER 미국S&P500
    "381170",  # TIGER 미국S&P500TR
    "396520",  # TIGER 미국S&P500배당귀족
    "423160",  # TIGER 미국S&P500레버리지(합성)
    "423170",  # TIGER 미국나스닥100레버리지(합성)
    "442580",  # TIGER 미국배당+7%프리미엄다우존스
    "458730",  # TIGER 미국나스닥100+15%프리미엄
    "195970",  # TIGER 유로스탁스50(합성H)
    "195980",  # TIGER 일본니케이225(H)
    "192720",  # TIGER 차이나CSI300
    "267980",  # TIGER 원유선물Enhanced(H)
    "160580",  # TIGER 구리실물
    "441680",  # TIGER 미국AI반도체핵심공정
    "395160",  # TIGER 미국필라델피아반도체나스닥
    "371460",  # TIGER 미국테크TOP10INDXX
    "371450",  # TIGER 글로벌혁신블루칩TOP10
    "448540",  # TIGER 미국S&P500배당귀족
    # KBSTAR (KB자산운용)
    "294400",  # KBSTAR 200 (= RISE 200, 2024.07 브랜드 통합)
    "270810",  # KBSTAR 코스닥150
    "315270",  # KBSTAR 200선물인버스2X
    "290080",  # KBSTAR 200고배당
    "334700",  # KBSTAR 단기통안채
    "385720",  # KBSTAR 국고채30년액티브
    "360200",  # KBSTAR 미국나스닥100
    "361580",  # KBSTAR 미국S&P500
    "453810",  # KBSTAR 미국배당킹
    # RISE (KB자산운용)
    "298770",  # RISE 코스닥150
    "438330",  # RISE 코스피고배당50
    "385510",  # RISE 단기통안채액티브
    "385540",  # RISE 단기채권액티브
    "379780",  # RISE 미국S&P500
    "445090",  # RISE 미국S&P500TR
    "488290",  # RISE 미국나스닥100TR
    # ACE (한국투자신탁운용) — 278470 제외(KOSPI200 에이피알 중복)
    "261240",  # ACE 200
    "400580",  # ACE 미국S&P500
    "367380",  # ACE 미국나스닥100
    "449450",  # ACE 미국S&P500TR
    "466940",  # ACE 미국나스닥100TR
    "402970",  # ACE 미국배당다우존스
    "449770",  # ACE 미국S&P500배당귀족
    "381620",  # ACE 미국빅테크TOP7Plus
    "468380",  # ACE 미국AI인프라
    # HANARO (NH아문디자산운용)
    "157450",  # HANARO 200
    "245710",  # HANARO 코스닥150
    "469150",  # HANARO 200동일가중
    "336160",  # HANARO 단기통안채액티브
    "432840",  # HANARO 미국S&P500
    # SOL (신한자산운용)
    "433330",  # SOL 미국S&P500
    "476030",  # SOL 미국나스닥100
    "446720",  # SOL 미국배당다우존스
    "472160",  # SOL 미국빅테크TOP7
}

# KOSPI200/KOSDAQ150과 중복 제거 (예: 278470 에이피알 = KOSPI200 종목이자 ACE ETF 코드 혼선)
KR_ETF_SYMBOLS -= KOSPI200_SYMBOLS | KOSDAQ150_SYMBOLS | KRX_EXTRA_SYMBOLS

# 국내 전체 스캔 대상 (중복 제거)
ALL_KR_SYMBOLS: set[str] = KOSPI200_SYMBOLS | KOSDAQ150_SYMBOLS | KRX_EXTRA_SYMBOLS | KR_ETF_SYMBOLS


# ── S&P 500 (504종목) ─────────────────────────────────────────────────────────
SP500_TICKERS: set[str] = {
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "GOOG", "META", "BRKB", "TSLA",
    "UNH", "LLY", "JPM", "XOM", "JNJ", "V", "PG", "AVGO", "MA", "HD", "CVX",
    "MRK", "ABBV", "PEP", "COST", "ADBE", "KO", "CSCO", "WMT", "TMO", "MCD",
    "PFE", "CRM", "BAC", "ACN", "CMCSA", "LIN", "NFLX", "ABT", "ORCL", "DHR",
    "AMD", "WFC", "DIS", "TXN", "PM", "VZ", "INTU", "COP", "CAT", "AMGN",
    "NEE", "INTC", "UNP", "LOW", "IBM", "BMY", "SPGI", "RTX", "HON", "BA",
    "UPS", "GE", "QCOM", "AMAT", "NKE", "PLD", "NOW", "BKNG", "SBUX", "MS",
    "ELV", "MDT", "GS", "DE", "ADP", "LMT", "TJX", "T", "BLK", "ISRG",
    "MDLZ", "GILD", "MMC", "AXP", "SYK", "REGN", "VRTX", "ETN", "LRCX", "ADI",
    "SCHW", "CVS", "ZTS", "CI", "CB", "AMT", "SLB", "C", "BDX", "MO",
    "PGR", "TMUS", "FI", "SO", "EOG", "BSX", "CME", "EQIX", "MU", "DUK",
    "PANW", "PYPL", "AON", "SNPS", "ITW", "KLAC", "ICE", "APD", "SHW", "CDNS",
    "CSX", "NOC", "CL", "MPC", "HUM", "FDX", "WM", "MCK", "TGT", "ORLY",
    "HCA", "FCX", "EMR", "MMM", "MCO", "ROP", "CMG", "PSX", "MAR", "PH",
    "APH", "GD", "USB", "NXPI", "AJG", "NSC", "PNC", "VLO", "F", "MSI",
    "GM", "TT", "EW", "CARR", "AZO", "ADSK", "TDG", "ANET", "SRE", "ECL",
    "OXY", "PCAR", "ADM", "MNST", "KMB", "PSA", "CCI", "CHTR", "MCHP", "MSCI",
    "CTAS", "WMB", "AIG", "STZ", "NUE", "ROST", "AFL", "KVUE", "AEP", "IDXX",
    "D", "TEL", "JCI", "MET", "GIS", "IQV", "EXC", "WELL", "DXCM", "HLT",
    "ON", "COF", "PAYX", "TFC", "BIIB", "O", "FTNT", "DOW", "TRV", "DLR",
    "MRNA", "CPRT", "ODFL", "DHI", "YUM", "SPG", "CTSH", "AME", "BKR", "SYY",
    "A", "CTVA", "CNC", "EL", "AMP", "CEG", "HAL", "OTIS", "ROK", "PRU",
    "DD", "KMI", "VRSK", "LHX", "DG", "FIS", "CMI", "CSGP", "FAST", "PPG",
    "GPN", "GWW", "HSY", "BK", "XEL", "DVN", "EA", "NEM", "ED", "URI",
    "VICI", "PEG", "KR", "RSG", "LEN", "PWR", "WST", "COR", "OKE", "VMC",
    "KDP", "WBD", "ACGL", "ALL", "IR", "CDW", "FANG", "MLM", "PCG", "DAL",
    "EXR", "FTV", "AWK", "IT", "KHC", "GEHC", "WEC", "HPQ", "EIX", "CBRE",
    "APTV", "TTD", "MTD", "DLTR", "AVB", "GDDY", "ALGN", "LYB", "TROW", "GLW",
    "EFX", "WY", "ZBH", "XYL", "SBAC", "RMD", "TSCO", "EBAY", "KEYS", "CHD",
    "STT", "COIN", "HIG", "ALB", "STE", "ES", "TTWO", "MPWR", "CAH", "EQR",
    "RCL", "WTW", "HPE", "DTE", "GPC", "BR", "ULTA", "FICO", "CTRA", "BAX",
    "AEE", "MTB", "MKC", "ETR", "WAB", "DOV", "FE", "RJF", "INVH", "FLT",
    "CLX", "TDY", "TRGP", "DRI", "LH", "HOLX", "VRSN", "MOH", "LUV", "PPL",
    "ARE", "NVR", "COO", "IBKR", "PHM", "NDAQ", "HWM", "RF", "CNP", "IRM",
    "LVS", "FITB", "EXPD", "VTR", "FSLR", "PFG", "BRO", "WDAY", "IEX", "BG",
    "ATO", "FDS", "EME", "MAA", "CMS", "IFF", "BALL", "SWKS", "CINF", "NTAP",
    "STLD", "UAL", "WAT", "OMC", "TER", "CCL", "JBHT", "TPL", "TYL", "HBAN",
    "K", "GRMN", "CBOE", "NTRS", "TSN", "AKAM", "EG", "ESS", "EQT", "TXT",
    "EXPE", "SJM", "PTC", "DGX", "AVY", "RVTY", "BBY", "CF", "CAG", "EPAM",
    "AMCR", "LW", "PAYC", "SNA", "AXON", "POOL", "SYF", "SWK", "ZBRA", "DPZ",
    "PKG", "CFG", "LDOS", "VTRS", "PODD", "CRH", "MOS", "APA", "EVRG", "TRMB",
    "MGM", "NDSN", "WDC", "MAS", "LNT", "MTCH", "STX", "CVNA", "TECH", "WRB",
    "LYV", "IP", "UDR", "AES", "WSM", "INCY", "L", "TAP", "GEN", "CPT",
    "KIM", "JKHY", "HRL", "HST", "FMC", "HOOD", "PEAK", "CIEN", "PNR", "NI",
    "CHRW", "HSIC", "CRL", "REG", "APO", "TKO", "KEY", "GL", "EMN", "WYNN",
    "ALLE", "PLTR", "FFIV", "DASH", "BXP", "APP", "ROL", "DDOG", "PNW", "DELL",
    "BLDR", "FOXA", "AOS", "HAS", "HII", "NRG", "CPB", "UHS", "ERIE", "KKR",
    "LII", "GEV", "BBWI", "NWSA", "TPR", "PARA", "SMCI", "BEN", "AIZ", "NCLH",
    "GNRC", "FRT", "IVZ", "SOLV", "CRWD", "DVA", "JBL", "LULU", "DECK", "UBER",
    "FIX", "RL", "VLTO", "FOX", "BX", "ABNB", "NWS", "EXE",
}

# ── 나스닥100 단독 (S&P500 미포함, 29종목 중 확인된 종목) ─────────────────────
NASDAQ100_EXTRA_TICKERS: set[str] = {
    "ASML",   # ASML Holding
    "SHOP",   # Shopify
    "ARM",    # Arm Holdings
    "PDD",    # PDD Holdings
    "MELI",   # MercadoLibre
    "MRVL",   # Marvell Technology
    "FER",    # Ferrovial
    "MSTR",   # Strategy (MicroStrategy)
    "ALNY",   # Alnylam Pharmaceuticals
    "CCEP",   # Coca-Cola Europacific Partners
    "TRI",    # Thomson Reuters
    "INSM",   # Insmed
    "ZS",     # Zscaler
    "TEAM",   # Atlassian
}

# ── 다우존스30 (S&P500 완전 포함 — 참조용) ──────────────────────────────────────
# 모든 DJIA 종목은 SP500_TICKERS에 이미 포함되어 있음
# ALL_US_TICKERS 계산에는 별도 추가 불필요 (SP500으로 자동 포함)
DJIA30_TICKERS: set[str] = {
    "AAPL",  # Apple
    "MSFT",  # Microsoft
    "AMZN",  # Amazon
    "NVDA",  # NVIDIA (2024-11 INTC 대체)
    "JPM",   # JPMorgan Chase
    "V",     # Visa
    "UNH",   # UnitedHealth
    "HD",    # Home Depot
    "KO",    # Coca-Cola
    "WMT",   # Walmart
    "MCD",   # McDonald's
    "GS",    # Goldman Sachs
    "AXP",   # American Express
    "CVX",   # Chevron
    "CAT",   # Caterpillar
    "BA",    # Boeing
    "HON",   # Honeywell
    "IBM",   # IBM
    "JNJ",   # Johnson & Johnson
    "MRK",   # Merck
    "MMM",   # 3M
    "PG",    # Procter & Gamble
    "SHW",   # Sherwin-Williams
    "TRV",   # Travelers
    "NKE",   # Nike
    "VZ",    # Verizon
    "DIS",   # Disney
    "CRM",   # Salesforce
    "AMGN",  # Amgen
    "DOW",   # Dow Inc.
}

# ── 미국 ETF (지수/채권/원자재/섹터/레버리지/해외/테마) ──────────────────────────
US_ETF_TICKERS: set[str] = {
    # 미국 주요 지수
    "SPY", "IVV", "VOO", "QQQ", "VTI", "QQQM", "DIA", "RSP", "OEF",
    "IWM", "IWB", "IWF", "IWD", "IWN", "IWO",
    "VUG", "VTV", "VB", "VO", "MDY", "IJH", "IJR",
    "SCHD", "VYM", "VIG", "DVY", "HDV", "NOBL", "DGRO", "DGRW",
    "JEPI", "JEPQ", "XYLD", "QYLD", "RYLD",
    "QUAL", "MTUM", "USMV", "VLUE", "SPHQ",
    "SCHB", "SCHX", "SCHA", "VBR", "VBK", "VOE", "VOT",
    # 채권
    "AGG", "BND", "TLT", "IEF", "SHY", "LQD", "HYG", "JNK", "MUB",
    "TIP", "BNDX", "VCIT", "VCSH", "BSV", "BIV",
    "VGSH", "VGIT", "VGLT", "GOVT", "SHV", "SGOV", "BIL", "USFR",
    "FLOT", "IGSB", "IGIB", "IGLB", "EMB", "SPTL", "IEI",
    "TMF", "TBT", "TBF", "TMV",
    # 원자재 — 금/은/백금
    "GLD", "IAU", "GLDM", "UGL", "GDX", "GDXJ",
    "SLV", "SIVR", "SIL", "PPLT", "PALL",
    # 원자재 — 에너지
    "USO", "BNO", "UCO", "DBO", "UNG", "BOIL", "KOLD",
    # 원자재 — 금속/농산물/복합
    "CPER", "COPX", "REMX", "URA",
    "DBA", "WEAT", "CORN", "SOYB", "MOO",
    "DBC", "PDBC", "GSG", "GNR", "WOOD",
    # 섹터 ETF
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLB", "XLI", "XLU", "XLRE", "XLC",
    "VGT", "VHT", "VFH", "VDE", "VCR", "VDC", "VPU", "VOX",
    "SOXX", "SMH", "SOXL", "SOXS",
    "IBB", "XBI", "IGV", "FTEC",
    "OIH", "XOP", "AMLP",
    "VNQ", "IYR",
    # 레버리지
    "TQQQ", "UPRO", "SPXL", "SSO", "QLD", "UDOW", "DDM", "ROM", "TECL", "FAS", "TNA",
    # 인버스
    "SQQQ", "SPXS", "SPXU", "SDOW", "TECS", "FAZ", "TZA", "SH", "PSQ", "DOG", "RWM",
    # 해외 지수
    "EEM", "VWO", "EFA", "IEFA", "VEA", "VT", "ACWI",
    "EWJ", "EWZ", "EWG", "EWY", "EWT", "FXI", "KWEB", "MCHI", "INDA", "EWC", "EWU",
    # 테마
    "ARKK", "ARKG", "ARKW", "ARKQ", "BOTZ", "AIQ",
    "ICLN", "TAN", "LIT", "DRIV", "PAVE", "CLOU", "SKYY", "CIBR", "BUG", "NLR",
    "IBIT", "FBTC", "BITO", "GBTC", "ETHA",
}

# SP500/나스닥100과 중복 제거 (개별주 티커가 ETF 세트에 들어올 경우 방지)
US_ETF_TICKERS -= SP500_TICKERS | NASDAQ100_EXTRA_TICKERS

# 미국 전체 스캔 대상 (중복 제거)
# DJIA30_TICKERS는 SP500_TICKERS의 부분집합이므로 별도 추가 불필요
ALL_US_TICKERS: set[str] = SP500_TICKERS | NASDAQ100_EXTRA_TICKERS | US_ETF_TICKERS
