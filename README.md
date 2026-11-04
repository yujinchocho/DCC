# DCC 2조 자극 사전검사 사이트

참여자용 정적 사이트입니다. `index.html`과 `img/`는 빌드 결과물이라 직접 고치지 않습니다.

- 참여자 링크: https://yujinchocho.github.io/DCC/
- 연결 테스트: 링크 끝에 `#test` (기록이 TEST- ID로 남음), 빠르게 넘기려면 `#test#fast`
- 화면 검토(시트로 보내지 않음): 링크 끝에 `#review-fin-a` 처럼 조건 지정
- 응답·행동 기록 저장소: 구글 시트 `DCC_2조_자극사전검사_raw` (Apps Script 웹 앱)

## 미니 재검사 (MiniEx.html) — 본실험과 같은 화면·문항
- 참여자 링크: https://yujinchocho.github.io/DCC/MiniEx.html
- 화면 검토(시트로 보내지 않음, 다음 조건 없이 넘어감): 링크 끝에 `#review-fin-a-tab` 처럼 조건·화면 지정 (화면: T0, sit1, home, tab, T1, sit2, travel, T2, end)
- 실제 참여 흐름 테스트: 링크 끝에 `#test` (TEST001…로 기록), 빠르게 넘기려면 `#test#fast`
- 응답 저장: `MiniEx.html` 안의 STUDY.endpoint 에 재검사용 시트의 Apps Script 주소를 넣어야 해요.
- 설문 속 고지·트래블 이미지: `img/cap_notice_{조건}.jpg`, `img/cap_travel_{fin|ott}.jpg` (참여자 조건에 맞는 것이 자동으로 들어가요)
