# 대시보드 디자인 참고

2026-11-16, Mobbin MCP의 web screen 검색 결과 이미지를 확인한 뒤 구현했습니다. 앱 화면 이미지를 복제하거나 서비스 로고를 사용하지 않았습니다.

- [Origin — 자산 개요](https://mobbin.com/screens/5b5753ac-de50-4505-a5e9-b7a9a65d6bab?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 순자산과 추이를 중심에 두고 예산·일정을 보조 영역에 배치하는 정보 구조를 참고했습니다.
- [Monarch — 월별 예산](https://mobbin.com/screens/5e9f66a0-5b8c-434a-841f-9c6cb2199bfd?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 월 선택, 예산 대비 잔여액, 항목별 지출을 함께 보여주는 구성을 참고했습니다.
- [Quicken — 지출 계획](https://mobbin.com/screens/58b75391-a791-4e80-969d-5c0fdefa009c?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 수입·결제·지출 계획을 분리해 읽는 구조를 검토했습니다.

모아에는 보라색과 짙은 자주색의 고유 팔레트, 원화 지표, 한국어 입력 화면, 계정별 기록을 적용했습니다. 대시보드는 4개 핵심 지표 → 자산 추이와 예산 → 자산 구성과 입출금 일정 순으로 구성합니다. 저장된 기록과 현재 잔액은 실선, 향후 예상은 점선으로 구분합니다. 작은 화면에서는 카드가 2열로 줄고, 메뉴를 가로로 스크롤할 수 있습니다.

## 적용 범위와 확인

사용자가 디자인 방향 판단을 위임했고 월별 예산·자산도 요청했으므로, 기존 데이터·항목별 입력·저장·백업·로그인은 유지하면서 대시보드 구성과 전체 공통 색상을 변경했습니다. 새로운 라이브러리·글꼴·아이콘 패키지는 추가하지 않았습니다.

| 화면의 문제 | 바꾼 부분 | 근거 |
| --- | --- | --- |
| 과거와 앞으로의 자산 흐름이 없음 | 대시보드 중앙에 자산 추이, 기록과 예상을 구분 | 위 Origin 자산 개요의 순자산 추이와 우측 예산 구성 |
| 월별 예산·잔여액 확인 기능이 없음 | 월 선택과 지출 한도·예정액·잔여액을 함께 표시 | 위 Monarch 월별 예산의 월 선택과 예산·잔여액 구성 |
| 월말별 기록과 예상값을 구별할 수 없음 | 실제 기록은 기준일을 표시하고 미래는 예상 표시와 점선으로 구분 | 사용자의 월말별 자산 요청에 따른 계산·보관 기능; 구분 방식은 구현 판단 |

기존 순자산·총자산·총부채, 주식 평가손익, 예금·퇴직금, 대출 월 이자, 입출금 일정은 대시보드에 유지합니다. 기존 항목별 입력 및 계정별 저장 경로도 유지합니다. 새 메뉴 이름은 '월별 예산', '자산 기록', '월말 예상'입니다.

계산·API 테스트 15개와 DOM에서 입력·수정·월 전환·예산 저장·수동 기록·과거 월 입력·12개월 예상표를 검증했습니다. 이 환경에서는 미리보기 릴레이 연결이 실패하여 실제 브라우저 화면 및 전후 비교 이미지는 캡처하지 못했습니다. 캡처를 추정 이미지로 대체하지 않았습니다.


## 맞춤 대시보드와 통계 구조 (2026-11-16)

사용자 요청: 섞여 있는 통계를 정리하고 빠진 항목을 보완하며, 드래그로 맞춤 통계를 구성하고 모호한 용어를 변경한다. 현재 색상·글꼴·테두리 없는 표면, 금융 원본 데이터, 기존 경로와 계산을 유지한다. GitHub 플러그인 추가는 명시적으로 요청한 범위다.

Mobbin MCP 검색에서 실제 확인한 화면:

- [Revolut Analytics](https://mobbin.com/screens/8fac3b7f-37ab-4ec5-81ae-a7a20f7d492d?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 상단 기간·계좌 필터, 지출·수입과 총자산의 별도 영역. 기간 통계와 현재 보유 자산을 구분하는 구조를 참고했다. 어두운 테마와 색상은 가져오지 않았다.
- [Quicken Reports](https://mobbin.com/screens/0b93f0f4-a0d2-42ec-91e2-924842b88b9d?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 기간과 필터 아래 집계, 그 아래 상세 거래표. 통합 통계에서 조건·요약·상세의 순서를 참고했다.
- [Quicken Customize Dashboard](https://mobbin.com/screens/90783f19-3381-4011-8f67-6049ae5a3cdb?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 별도 편집 영역에서 통계별 손잡이와 표시 제어, 취소·완료. 편집 상태에서 선택·정렬 후 저장하는 흐름을 참고했다.
- [Monarch Customize Dashboard](https://mobbin.com/screens/e038c2e6-29e9-4f66-8fc3-e8d6d703735f?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 모달에서 대시보드 통계를 선택·배치. 카드 추가 모달과 두 열의 카드 구성을 참고했다.
- [Rocket Money Spending](https://mobbin.com/screens/4ffdc60c-95f8-4920-8339-5724906f1d1b?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp): 지출, 예산, 순자산의 목적별 메뉴와 기간 선택. 분석과 잔액·계획을 구분하는 메뉴의 예시로 참고했다.

위 화면은 구조의 근거다. 한국어 용어, 완료 기록/일정/예측의 정의, 퇴직연금의 별도 집계와 정확한 배치는 이 제품의 계산 모델과 사용자의 요청에 맞춰 정했다. 실제 브라우저 캡처가 불가능하여 변경 전후 이미지는 제작하지 않았다. DOM과 계산 테스트를 화면 캡처 검증으로 주장하지 않는다.

## Stripe 시각 디자인 적용 (2026-11-17 KST)

사용자가 지정한 Stripe 디자인을 현재 시각 기준으로 적용했다. 이전 기록의 색상 유지 조건은 이 명시적 요청으로 갱신된다. 참조 캡처별 적용, 보존 항목, 검색·CSV 추가와 검증 제한은 [Stripe 디자인 변경 기록](stripe-redesign.md)에 있다.
