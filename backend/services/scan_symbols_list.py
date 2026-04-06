"""스캔 대상 종목 리스트 — 코스피200, 코스닥150, KRX 반도체/2차전지/바이오, S&P500, 나스닥100, Russell1000, Russell2000 큐레이션.

출처: .claude/docs/buy종목리스트정리.md (2026-04-05 기준)
중복 제거 후 국내 ~371종목 + 미국 ~959종목 = 총 ~1,330종목
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

# ── KRX 바이오 추가 (코스피200·코스닥150 미포함 바이오/제약 17종목) ─────────────
KRX_BIO_EXTRA_SYMBOLS: set[str] = {
    "170900",  # 동아에스티
    "067630",  # HLB생명과학
    "019170",  # 신풍제약
    "007570",  # 일양약품
    "000020",  # 동화약품
    "003850",  # 보령
    "003520",  # 영진약품
    "001060",  # JW중외제약
    "011040",  # 경동제약
    "034060",  # 조아제약
    "017180",  # 명인제약
    "220100",  # 제테마
    "048530",  # 인트론바이오
    "064550",  # 바이오니아
    "011000",  # 진원생명과학
    "299660",  # 셀리드
    "095700",  # 제넥신
}

# 국내 전체 스캔 대상 (중복 제거)
ALL_KR_SYMBOLS: set[str] = KOSPI200_SYMBOLS | KOSDAQ150_SYMBOLS | KRX_EXTRA_SYMBOLS | KRX_BIO_EXTRA_SYMBOLS


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

# ── Russell 1000 단독 (S&P500·나스닥100 미포함, ~323종목) ───────────────────────
RUSSELL1000_EXTRA_TICKERS: set[str] = {
    # 기술 — 소프트웨어/클라우드
    "SNOW", "NET", "ZM", "HUBS", "DOCU", "OKTA", "MDB", "GTLB", "PCTY", "TOST",
    "PRCT", "CFLT", "NTNX", "PATH", "S", "FRSH", "BRZE", "BILL", "ZI", "CWAN",
    "ASAN", "DBX", "BOX", "DOCN", "WK", "ESTC", "AFRM", "RBLX", "U", "VEEV",
    "CDAY", "PYCR", "INFA", "CCCS", "SPSC", "NCNO", "ALKT", "ALRM", "AVPT",
    "FLYW", "AGYS", "PEGA", "DOMO", "YEXT", "APPN", "DSGX", "EXLS", "TASK", "BIGC",
    # 기술 — 반도체/하드웨어
    "COHR", "ONTO", "ACLS", "CRUS", "SLAB", "AMBA", "UCTT", "CRDO", "AEIS",
    "ALGM", "FORM", "DIOD", "MTSI", "IPGP", "RMBS", "POWI", "LSCC", "SITM",
    "CGNX", "LITE", "VIAV", "SMTC", "MKSI", "PLXS", "NSIT", "KLIC", "CEVA",
    # 소비재 — 임의소비재
    "DKNG", "RH", "BOOT", "WING", "TXRH", "ELF", "KMX", "AN", "LAD", "ABG",
    "GPI", "SAH", "PAG", "CPRI", "LEVI", "VFC", "GIII", "COTY", "HGV", "VAC",
    "TNL", "SHAK", "SG", "HAYW", "PENN", "CZR", "CHDN", "PLNT", "CAKE", "EAT",
    "BLMN", "DIN", "BROS", "PLAY", "IAC", "CARS", "MODG", "WGO", "BC", "FOXF",
    "FL", "GPS", "URBN", "VSCO", "PVH", "HBI", "CRI", "ANF", "AEO", "CHWY",
    "YETI", "PTON", "GENI",
    # 헬스케어
    "NTRA", "EXAS", "HALO", "IONS", "ROIV", "LEGN", "DNLI", "RGEN", "ARWR",
    "ACAD", "NVCR", "MDGL", "KRYS", "IRTC", "RXRX", "FOLD", "PCVX", "HIMS",
    "DOCS", "GKOS", "MMSI", "LIVN", "RARE", "ARDX", "IMVT", "AXSM", "PTCT",
    "RCKT", "KYMR", "TVTX", "XNCR", "APLS", "BEAM", "NTLA", "PRAX", "SAGE",
    "NVAX", "LNTH", "OMCL", "SDGR", "CLDX", "DAWN", "GMED", "ICUI", "MRUS",
    "IMCR", "ARQT", "PTGX",
    # 금융
    "LPLA", "RYAN", "WTFC", "PIPR", "VOYA", "STEP", "FCNCA", "WD", "PNFP",
    "SFBS", "CVBF", "BANR", "WSFS", "INDB", "FULT", "FFIN", "BOKF", "UMBF",
    "GBCI", "CATY", "HWC", "OFG", "COLB", "SYBT", "JLL", "NMRK", "RDFN",
    "COMP", "EXPI", "HASI", "STWD", "BXMT", "GCMG", "GDOT", "UWMC", "COOP",
    "IIPR",
    # 산업재
    "GXO", "SAIA", "NVT", "IBP", "SITE", "TREX", "WMS", "CSWI", "RBC", "BMI",
    "FLR", "KBR", "KTOS", "CACI", "PSN", "DRS", "MRCY", "BAH", "ICFI", "APOG",
    "GFF", "MWA", "UFPI", "BCC", "LPX", "AZEK", "LGIH", "GRBK", "TMHC", "MHO",
    "SKY", "CVCO", "KNX", "RXO", "HUBG", "MATX", "R", "J", "EXPO", "ACA",
    "RUSHA", "HERC", "LBRT", "PTEN", "OII", "TDW", "GEO", "CXW", "GATX", "NE",
    "ASGN", "KFY", "MAN", "KFRC",
    # 에너지
    "CIVI", "SM", "CHRD", "MUR", "SWN", "PBF", "VTLE", "TALO", "RRC", "GPOR",
    "CNX", "MTDR", "CRGY", "NOG", "DINO", "INT", "HESM", "AM", "KNTK", "SBOW",
    # 소재
    "CC", "OLN", "CRS", "HXL", "IOSP", "TROX", "KALU", "CENX", "SXT",
    # 통신/미디어
    "LSXMA", "FWONA", "LBTYA", "CARG", "ZD", "AMCX", "NXST", "SEAT",
    # 부동산 (S&P500 미포함 REIT)
    "STAG", "TRNO", "KRG", "IRT", "NHI", "OHI", "SBRA", "AIV", "UE", "ROIC",
    "FCPT", "GTY",
    # 암호화폐 채굴/관련
    "MARA", "RIOT", "HUT", "IREN", "CORZ", "CLSK",
}

# ── Russell 2000 큐레이션 (SP500·나스닥100·Russell1000 미포함, 117종목) ──────────
RUSSELL2000_EXTRA_TICKERS: set[str] = {
    # Tech SaaS
    "APPF",   # AppFolio — 부동산 관리 SaaS
    "BLKB",   # Blackbaud — 비영리 SaaS
    "COUR",   # Coursera — 온라인 교육 플랫폼
    "CSGS",   # CSG Systems — 통신 빌링 SaaS
    "EVTC",   # EVERTEC — 중남미 결제 플랫폼
    "FOUR",   # Shift4 Payments — 결제 솔루션
    "GSHD",   # Goosehead Insurance — 보험 플랫폼
    "HLIT",   # Harmonic — 비디오 스트리밍 인프라
    "INST",   # Instructure — LMS 플랫폼
    "MNTV",   # Momentive — 설문조사 SaaS
    "PCOR",   # Procore — 건설 프로젝트 관리 SaaS
    "RELY",   # Remitly — 국제 송금 플랫폼
    "RPAY",   # Repay Holdings — 결제 기술
    "WEAV",   # Weave Communications — 의료 커뮤니케이션 SaaS
    "XPOF",   # Xponential Fitness — 피트니스 프랜차이즈
    # 반도체/하드웨어
    "AEHR",   # Aehr Test Systems — 반도체 테스트 장비
    "AXTI",   # AXT Inc. — 반도체 기판 소재
    "CALX",   # Calix — 광대역 클라우드 플랫폼
    "CLFD",   # Clearfield — 광섬유 네트워크 장비
    "IDCC",   # InterDigital — 무선 기술 특허
    "PLAB",   # Photronics — 포토마스크
    "QLYS",   # Qualys — 클라우드 보안 플랫폼
    "WOLF",   # Wolfspeed — SiC 전력반도체
    # 헬스케어/바이오테크
    "ADMA", "AKRO", "ALKS", "AMPH", "ANIP", "ATRC", "AVNS", "BBIO",
    "CNMD", "DVAX", "ENSG", "ENTA", "FLGT", "HRMY", "IDYA", "INVA",
    "IOVA", "ITCI", "LGND", "LMAT", "LXRX", "MDXG", "MRVI", "NARI",
    "OCUL", "OPCH", "PCRX", "RCUS", "RDNT", "RLAY", "RVNC", "RYTM",
    "SANA", "SIGA", "SILK", "SPRY", "SRPT", "STAA", "SUPN", "THRM",
    "TMDX", "URGN", "VCEL", "VREX",
    # 금융
    "CHCO",   # City Holding — 지역 은행
    "HURN",   # Huron Consulting — 경영 컨설팅
    "KELYA",  # Kelly Services — 인력 파견
    "MGRC",   # McGrath RentCorp — 장비 렌탈
    "MNRO",   # Monro — 자동차 서비스
    "PFBC",   # Preferred Bank — 캘리포니아 지역은행
    "QCRH",   # QCR Holdings — 지역 은행
    "SASR",   # Sandy Spring Bancorp — 지역 은행
    "SBCF",   # Seacoast Banking — 플로리다 지역은행
    "SFNC",   # Simmons Financial — 지역 은행
    "SNEX",   # StoneX Group — 금융 서비스
    "TOWN",   # Townebank — 지역 은행
    "TRMK",   # Trustmark — 지역 은행
    "WAFD",   # Washington Federal — 지역 은행
    # 산업/운송/소재
    "ACHR",   # Archer Aviation — 전기 항공 모빌리티
    "AGX",    # Argan — 전력 플랜트 건설
    "ALGT",   # Allegiant Travel — 저비용 항공사
    "ARCB",   # ArcBest — 화물 운송
    "ASTE",   # Astec Industries — 도로건설 장비
    "ATSG",   # Air Transport Services — 화물 항공
    "BCPC",   # Balchem — 특수 화학
    "BRC",    # Brady — 산업용 라벨/표시
    "CABO",   # Cable One — 케이블/인터넷 서비스
    "CECO",   # CECO Environmental — 환경 설비
    "CMCO",   # Columbus McKinnon — 호이스트/리프팅
    "DAN",    # Dana Inc. — 차량 부품
    "DNOW",   # NOW Inc. — 산업용 공급망
    "DXPE",   # DXP Enterprises — 산업 유통
    "EPC",    # Edgewell Personal Care — 소비재
    "ESE",    # ESCO Technologies — 유틸리티 솔루션
    "FWRD",   # Forward Air — 항공 화물 운송
    "HLIO",   # Helios Technologies — 유압 솔루션
    "HSII",   # Heidrick & Struggles — 임원 채용
    "HWKN",   # Hawkins — 화학 유통
    "JOBY",   # Joby Aviation — 전기 에어택시
    "LOPE",   # Grand Canyon Education — 고등교육
    "MBUU",   # Malibu Boats — 레저 보트
    "MYRG",   # MYR Group — 전기 건설
    "POWL",   # Powell Industries — 전기 배전 장비
    "RCII",   # Rent-A-Center — 가전 렌탈
    "ROCK",   # Gibraltar Industries — 건설 자재
    "SMPL",   # Simply Good Foods — 건강식품
    "SPTN",   # SpartanNash — 식료품 유통
    "STRL",   # Sterling Infrastructure — 인프라 건설
    # 우주/크립토 인프라
    "CIFR",   # Cipher Mining — 비트코인 채굴
    "IONQ",   # IonQ — 양자 컴퓨팅
    "LUNR",   # Intuitive Machines — 달 탐사
    "RKLB",   # Rocket Lab — 소형 로켓 발사
    "SPCE",   # Virgin Galactic — 우주 관광
    "SPIR",   # Spire Global — 위성 데이터
}

# 미국 전체 스캔 대상 (중복 제거)
ALL_US_TICKERS: set[str] = SP500_TICKERS | NASDAQ100_EXTRA_TICKERS | RUSSELL1000_EXTRA_TICKERS | RUSSELL2000_EXTRA_TICKERS
