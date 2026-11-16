# 모아 대시보드 디자인 시스템

## 목적

현재 잔액을 확인하고 수입·지출 일정에 따른 미래 예금·순자산을 확인하는 개인 자산관리 웹 앱. 사용자가 지적한 혼란스러운 메뉴, 핵심 금액의 숨김, 낮은 대비와 불균일한 글자 크기를 함께 수정한다.

## 적용 도구

- GitHub UI UX Pro Max 플러그인 2.15.0: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- 검토·설치 버전: `e59ff376a41f7ca47b7541ad5c116495cbade3ee` (MIT).
- 작업 환경 원본: `/workspace/tools/ui-ux-pro-max`.
- 프로젝트의 Codex 스킬 설치 위치: `.agents/skills/ui-ux-pro-max/` (Git 제외, 금융정보 없음).
- `search.py 'banking analytics dashboard' --design-system`: Data-Dense Dashboard의 데이터 배치와 구분을 참고. 반환된 마케팅 페이지 구조와 비한국어 폰트는 이 앱에 맞지 않아 적용하지 않았다.
- `search.py 'financial time series forecast' --domain chart`: 실제/예상 실선·점선 구분, 키보드 선택, 직접 금액 확인, 데이터 표 제공을 적용. 통계적으로 산출하지 않은 신뢰구간은 만들지 않았다.
- `search.py 'navigation hierarchy sidebar' --domain ux`: 위치 표시와 제목 계층 확인. 제품별 분류와 한국어 명칭은 사용자 요구에 맞춰 직접 결정.
- Mobbin에서 실제 인라인 화면 3개를 확인. 밝은 화면과 항목별 탭을 사용하는 Rocket Money, Quicken을 참고. Monarch의 어두운 여러 위젯 배치는 선택하지 않음.

## 정보 구조

| 주요 메뉴 | 하위 화면 |
|---|---|
| 홈 | 자산 한눈에, 맞춤 대시보드 |
| 보유 자산 | 전체 자산, 예금·현금, 주식·투자, 퇴직금·연금 |
| 수입·지출 | 수입·지출 내역, 정기 지출, 예정 거래, 입출금 달력 |
| 대출·카드 | 대출 현황, 카드 청구, 상환 전략·AI |
| 자금 계획 | 월별 전망, 급여일 전망, 월 예산 |
| 분석·기록 | 기간별 분석, 자산 기록 |

기존 주소, API, 저장 형식, 인증과 개인별 데이터 분리는 유지한다. 새 전체 자산 화면은 기존 자산을 집계하며 별도 원장을 생성하지 않는다. 이름을 바꾼 화면의 기존 딥링크도 계속 동작한다.

## 시각 규칙

- 모든 글자 크기는 `public/design.css`가 관리. 기존 스타일에서 개별 크기를 제거해 중첩 규칙 충돌을 줄임.
- 12px 보조·차트, 14px 본문·표·컨트롤, 16px 메뉴·입력, 18px 패널 제목, 24/28px 주요 금액·제목. 모바일에서 메뉴는 12px, 주요 금액은 24px.
- 숫자는 tabular-nums. 금액 숫자를 SVG의 확대 비율로 키우지 않음.
- 기본 배경은 회색, 내용 영역은 흰색. 청록색은 선택·주요 버튼·자산 흐름에 사용.
- 확인한 대비: 기본 글자/배경 13.67:1, 보조 글자/흰색 8.82:1, 설명/배경 5.06:1, 흰색/주요 버튼 6.90:1.
- 경계선 1px, 표면 반경 14px. 움직임과 장식 문구를 줄이고 reduced-motion을 존중.
- 한 화면 폭에 맞춰 차트 좌표와 라벨 간격을 다시 계산. 날짜가 있는 데이터는 실제 날짜 간격을 사용.
- 시간순 원자료를 직선으로 잇는다. 실제는 실선, 예상은 점선. 축은 반올림한 눈금, 툴팁은 날짜와 정확한 원화 금액만 표시.

## 주요 변경 근거

1. 사이드바는 큰 관리 목적, 하위 항목은 페이지 상단 탭. Rocket Money의 Summary/Assets/Debt 탭을 참고. 여섯 가지 그룹과 한국어 명칭은 자체 판단.
2. 홈은 순자산·예금·부채·월 수지부터, 그 아래 흐름·예산·가까운 일정. Quicken의 net worth와 bills/income 배치를 참고. 현재 잔액과 전망을 별도로 명시.
3. 차트의 숫자·점·선 두께와 표의 글자를 같은 크기 체계로 조정. Rocket Money와 Quicken의 작은 축 라벨·중앙 흐름 그래프를 참고.
4. 자산 구성은 금액을 읽을 수 있는 행과 작은 누적 막대로 표현. Rocket Money의 자산별 합계 행을 참고. 대출 월 이자 합계를 직접 노출한 것은 사용자 요구에 따른 판단.

참고 화면:
- Rocket Money: https://mobbin.com/screens/5baa872a-cd1c-4e35-b559-ef1caf7f6597?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp
- Quicken: https://mobbin.com/screens/2343998c-7cec-4727-b885-63c4bd6a96d8?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp

## 검증

84개 Node 테스트, 별도 DOM 실행으로 18개 경로·6개 메뉴·7개 유형의 서버 저장, 예정 거래 포함·제외, 차트 기간·금액 숨김, 주요 이자 표시 확인. 차트의 모바일·데스크톱 좌표 재계산을 테스트했다. CSS 네 파일이 정상 구문으로 파싱됨을 확인했다.

관리형 미리보기는 `relay could not open browser port 4173`로 실패했다. 실제 브라우저의 화면 배치와 전후 스크린샷은 검증하지 못했다. DOM 테스트를 브라우저 시각 검증으로 간주하지 않는다.

맞춤 통계의 카드·순서·기간 설정과 계정별 dashboard-only 저장을 최신 배포본에서 통합했다. 맞춤 화면은 홈의 별도 탭으로 옮겼고, 통계에서 카드 추가 시 이 탭으로 연결한다.
