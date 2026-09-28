# DART 재무 분석

DART Open API로 상장사 사업보고서 재무제표를 불러와 5개년으로 정리하고, 재무비율·추이 차트·기업 간 비교를 제공하는 모바일 우선 웹앱입니다. 요구사항과 계정·비율 정의는 [PRD.md](./PRD.md)에 있습니다.

- **검색** — 회사명/종목코드 부분일치, 최근 본 기업
- **재무제표** — 재무상태표·손익계산서·현금흐름표 5개년, 연결/별도, 억원/백만원
- **재무비율** — 수익성·안정성·성장성·활동성 16개 (평균잔액 기준)
- **차트** — 매출·이익 + 영업이익률 복합 차트, 비율 추이
- **비교** — 최대 3개사, 링크로 공유 (`/compare?corps=a,b,c`)
- **PWA** — 홈 화면에 설치

기술 스택: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Recharts · Vitest

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # DART_API_KEY= 에 인증키 입력
npm run build:corps                # 상장사 목록 data/corps.json 생성 (최초 1회, 이후 가끔)
npm run dev                        # http://localhost:3000
```

DART 인증키는 [opendart.fss.or.kr](https://opendart.fss.or.kr) → 인증키 신청/관리에서 발급합니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | Vitest (파싱·정규화·비율·포맷 등 순수 로직) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run build:corps` | DART 고유번호 zip → `data/corps.json` (상장사만) |

> dev 서버가 켜진 상태에서 `npm run build`를 돌리면 `.next`가 덮여 dev 서버가 깨집니다. 하나씩 실행하세요.

## Vercel 배포

### 1. 상장사 목록을 저장소에 포함

`data/corps.json`(약 250KB)은 검색·비교에 쓰는 상장사 목록입니다. 배포 빌드에서도 새로 받지만, **받기에 실패했을 때의 대비로 저장소에 커밋해 두는 것을 권장**합니다.

```bash
npm run build:corps
git add data/corps.json
```

`.env.local`은 `.gitignore`에 있어 커밋되지 않습니다. 인증키는 아래 3단계에서 Vercel에만 넣습니다.

### 2. 프로젝트 연결

**GitHub 연동 (권장)**

1. 이 폴더를 GitHub 저장소로 push
2. [vercel.com/new](https://vercel.com/new) → 저장소 Import → Framework Preset은 **Next.js** 자동 인식

**또는 CLI**

```bash
npx vercel login
npx vercel link          # 프로젝트 생성/연결
```

### 3. 환경변수 `DART_API_KEY`

Vercel 대시보드 → Project → **Settings → Environment Variables**

| Key | Value | Environments |
|---|---|---|
| `DART_API_KEY` | 발급받은 인증키 | Production, Preview (필요하면 Development) |

이 키는 **빌드 시**(상장사 목록 갱신)와 **런타임**(재무제표 조회) 모두에 쓰입니다. 키를 바꾼 뒤에는 **Redeploy**해야 반영됩니다.

CLI로 넣으려면:

```bash
npx vercel env add DART_API_KEY production
npx vercel env add DART_API_KEY preview
```

### 4. 빌드 — `build:corps`가 실행되는 시점

Vercel은 `package.json`에 `vercel-build` 스크립트가 있으면 `build` 대신 그것을 실행합니다.

```json
"vercel-build": "npm run build:corps -- --keep-on-error && next build"
```

- **배포할 때마다** 빌드 직전에 상장사 목록을 새로 받습니다 (신규 상장·상장폐지 반영).
- DART 장애·키 오류로 받지 못해도 `--keep-on-error` 덕분에 **커밋된 `data/corps.json`으로 빌드를 계속**합니다. 커밋된 파일도 없으면 빌드가 실패합니다.
- 목록만 갱신하고 싶으면 코드 변경 없이 Vercel에서 **Redeploy**하면 됩니다.
- `data/corps.json`은 런타임에 파일로 읽으므로 `next.config.ts`의 `outputFileTracingIncludes`로 서버 함수 번들에 포함시킵니다.

Build Command를 대시보드에서 직접 지정했다면 `npm run vercel-build`로 맞춰 주세요.

### 5. 배포

GitHub 연동이면 main 브랜치에 push할 때마다 자동 배포됩니다. CLI는:

```bash
npx vercel --prod
```

서버 함수 리전은 `vercel.json`에서 서울(`icn1`)로 지정했습니다. DART 서버가 국내에 있어 응답이 빠릅니다.

### 6. 휴대폰에서 확인

배포 URL을 휴대폰에서 열고 아래 흐름을 확인합니다.

1. 검색에서 "삼성" 입력 → 삼성전자 선택
2. 재무제표: 가로 스크롤·연결/별도·억원/백만원 전환
3. 재무비율: 비율 이름을 눌러 계산식 확인
4. 차트: 차트를 터치해 툴팁 확인
5. "다른 회사와 비교" → 회사 추가 → 링크 공유
6. 검색 화면에 "최근 본 기업" 표시
7. 홈 화면에 설치
   - **Android Chrome**: 메뉴(⋮) → **앱 설치** 또는 **홈 화면에 추가**
   - **iOS Safari**: 공유 버튼 → **홈 화면에 추가**

## 문제 해결

| 증상 | 원인·조치 |
|---|---|
| "API 키 오류" 화면 (010/011) | `DART_API_KEY` 미설정·오타. Vercel 환경변수 확인 후 Redeploy |
| 012 접근할 수 없는 IP | DART가 요청 IP를 거부한 경우. opendart 인증키 관리 화면에서 키 상태를 확인하고, 해결되지 않으면 DART에 문의 |
| "조회 한도 초과" (020) | DART 일일 호출 한도 초과. 응답은 하루 캐시되므로 같은 회사 재조회는 호출이 늘지 않음 |
| 검색이 "data/corps.json이 없습니다" | 빌드 시 목록 생성 실패 + 커밋된 파일 없음. 로컬에서 `npm run build:corps` 후 커밋 |
| "데이터 없음" (013) | 연결재무제표가 없는 회사 → 별도(OFS)로 전환. 신규 상장·일부 금융업은 사업보고서 재무제표가 없음 |

## 구조

```
app/                     라우트 (검색 /, 회사 /company/[corp_code], 비교 /compare, API /api/*)
components/              UI (company/, compare/, charts/)
lib/dart/                DART 클라이언트(서버 전용, 하루 캐시)·에러 타입·기업 목록
lib/normalize/           금액 파싱, 표준 계정 매핑, 재무제표 표 구성
lib/ratios/              재무비율 (순수 함수)
scripts/build-corp-list.ts  상장사 목록 생성
data/corps.json          상장사 목록 (생성물)
```
