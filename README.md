# DCC 2조 자극 사전검사 사이트

참여자용 정적 사이트입니다. `index.html`과 `img/`는 빌드 결과물이라 직접 고치지 않습니다.

- 참여자 링크: https://yujinchocho.github.io/DCC/
- 연결 테스트: 링크 끝에 `#test` (기록이 TEST- ID로 남음), 빠르게 넘기려면 `#test#fast`
- 화면 검토(시트로 보내지 않음): 링크 끝에 `#review-fin-a` 처럼 조건 지정
- 응답·행동 기록 저장소: 구글 시트 `DCC_2조_자극사전검사_raw` (Apps Script 웹 앱)

## 본실험 (Main.html)
- 참여자 링크: https://yujinchocho.github.io/DCC/Main.html
- 테스트: 링크 끝에 `#test` (번호 TEST…, 끝난 뒤에도 다시 시작) · 기록 지우기 `#reset` · 화면 확인 `#review-fin-a-home` 처럼 조건·페이지 지정
- 미니 재검사와 달라진 점: 홈에서는 상단 '다음'이 잠기고 하단 상품/추천 탭(8초 뒤 말풍선)으로만 이동 · T1 상단 문구 "실제로 사용하는 [금융/OTT] 서비스라고 생각하며 답해주세요."
- 마지막 화면: 보상 안내(추첨 20명 스타벅스 쿠폰) + 휴대전화 번호 선택 입력 → 시트 responses의 END_phone 열 (pages 시트에도 기록)
- 참여자 번호: MS001… (미니 재검사 RT…와 따로 세고, 조건 배정도 MS끼리만 맞춰요)
- 응답 저장: 지금은 미니 재검사 시트로 들어가요. 본실험 시트를 따로 만들면 `Main.html`의 STUDY.endpoint를 그 주소로 바꿔 주세요.

## 미니 재검사 (MiniEx.html) — 본실험과 같은 화면·문항
- 참여자 링크: https://yujinchocho.github.io/DCC/MiniEx.html
- 화면 검토(시트로 보내지 않음, 다음 조건 없이 넘어감): 링크 끝에 `#review-fin-a-tab` 처럼 조건·화면 지정 (화면: T0, sit1, home, tab, T1, sit2, travel, T2, end)
- 실제 참여 흐름 테스트: 링크 끝에 `#test` (TEST001…로 기록), 빠르게 넘기려면 `#test#fast`
  - 테스트는 끝까지 마쳐도 다시 열면 처음부터 새로 시작해요. 도중에 닫았다 열면 '이어서 하기 / 처음부터 다시'를 고를 수 있어요.
- 이 기기의 참여 기록 지우기(참여자 모드로 직접 해 본 경우): 링크 끝에 `#reset`
- 응답 저장: `MiniEx.html` 안의 STUDY.endpoint 에 재검사용 시트의 Apps Script 주소를 넣어야 해요.
- 설문 속 고지·트래블 이미지: `img/cap_notice_{조건}.jpg`, `img/cap_travel_{fin|ott}.jpg` (참여자 조건에 맞는 것이 자동으로 들어가요)
