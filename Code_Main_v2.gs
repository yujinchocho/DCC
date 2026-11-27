/**
 * DCC 실험 본실험 v2.0 (재설문) — 응답·행동 기록 저장소 (Google Apps Script)
 *
 * ★ 이 파일은 '본실험 v2.0 전용 새 구글 시트'에 붙여넣는 코드예요. (사이트: Main_v2.html · 참여자 번호 RS001…)
 *   파일럿·사전 연구 시트에 붙여넣은 코드는 바꾸지 마세요.
 * ★ assign 탭 열 순서: pid · cond · status · started_at · completed · completed_at · code · device_key · last_page · last_stage · last_screen · last_seen
 *   (status를 앞으로 옮긴 버전 — 코드가 열 이름으로 위치를 찾으니 HEAD.assign만 고치면 순서가 바뀌어요. 시트에서 손으로 열을 옮기지는 마세요.)
 *
 * 설치
 *  1. 연구 버전마다 구글 시트를 따로 하나씩 만들어요. (사전 연구 시트 / v2.0 파일럿 시트 / 본실험 v2.0 시트)
 *  2. 시트 메뉴 [확장 프로그램 → Apps Script]를 열고, 이 파일 내용을 전부 붙여넣고 저장해요.
 *  3. [배포 → 새 배포 → 유형: 웹 앱]  실행 사용자: 나 / 액세스 권한: 모든 사용자 → '웹 앱 URL'(…/exec) 복사
 *  코드를 고친 뒤에는 [배포 관리 → 연필(수정) → 버전: 새 버전 → 배포]로 다시 배포해야 반영돼요. (주소는 그대로예요)
 *
 * 시트 탭 (데이터가 들어올 때 자동으로 만들어져요. 탭 순서는 바꿔도 되지만 탭 이름은 바꾸지 마세요)
 *  - assign    : 참여자 번호, 배정 조건, 시작·완료 시각, 진행 상태(미시작/진행 중/이탈/완료)와 마지막 위치
 *  - summary   : 끝까지 마친 참여자의 행동 지표 요약 (참여자당 한 줄)
 *  - responses : 설문 응답 (참여자당 한 줄, 문항마다 한 열. 열 이름은 시점_문항번호, 예: T0_q9, T2_q14_1)
 *  - pages     : (쓰지 않음) 예전 설문 페이지 제출 기록 — 페이지별 응답 시간은 responses의 T0_ms·T1_ms·T2_ms 열
 *  - events    : 행동 기록 (참여자당 한 줄, 행동들은 events_1 칸부터 이어서 JSON으로)
 *  - events_flat: 메뉴 [연구 도구 → 행동 기록 펼치기]를 누르면 생김 — 한 행동 = 한 줄, 참여자별 시간 순·접기 (분석은 이 탭으로)
 *  - errors    : 저장 중 오류가 나면 내용이 남아요 (정상이면 생기지 않아요)
 * 머리글(1행) 칸에 마우스를 올리면 한글 설명이 보여요.
 *
 * 진행 상태 (assign의 status 열) — 설문 제출·완료 때 본인 줄은 바로 바뀌고, 이탈 판정·색은 메뉴 [상태 새로고침]·자동 새로고침 때 계산해요
 *  - 미시작 : 동의·배정은 했지만 첫 설문 페이지를 아직 내지 않음 (자극을 보기 전)
 *  - 진행 중: 첫 설문은 냈고, 마지막 기록이 IDLE_MIN분 안에 있음
 *  - 이탈   : 첫 설문은 냈지만, 마지막 기록 뒤 IDLE_MIN분 넘게 아무 기록이 없음
 *  - 완료   : 마무리 화면까지 도착
 *  기록이 안 들어오는 동안에도 '진행 중 → 이탈'이 바뀌게 하려면 메뉴 [연구 도구 → 상태 자동 새로고침 켜기]를 한 번 눌러 주세요.
 *  예전 기록의 마지막 위치를 채우려면 [연구 도구 → 상태 다시 계산 (전체)]를 누르면 돼요.
 *
 * 한꺼번에 몰릴 때 (업체 배포)
 *  - 구글 웹 앱은 '실행 사용자: 나' 계정 하나로 동시에 30개까지만 실행돼요. 그래서 요청 하나하나를 짧게, 서로 기다리지 않게 만들었어요.
 *    · 설문·완료·행동 기록: 순서 대기 없이 저장 (assign·responses·events는 배정 때 만든 자기 줄의 해당 칸만 고침)
 *    · 새 줄은 appendRow를 쓰지 않고 순서 구간에서 줄 번호만 예약 → 쓰기는 밖에서 (appendRow를 동시에 부르면 줄이 덮여 사라짐)
 *    · 조건 배정: 번호·인원 계산만 순서대로(시트 대신 스크립트 속성 메모를 읽어 수십 ms) → 줄 추가는 순서 밖에서
 *    · 순서가 꼭 필요한 건 새 줄·새 열 만들기뿐 (LOCAL 참여자, 첫 응답의 문항 열) — 못 받으면 '바쁨' → 페이지가 다시 보냄
 *  - 진행 상태(이탈 판정·색)는 요청 때 다시 계산하지 않아요. 메뉴 [상태 새로고침] 또는 [상태 자동 새로고침 켜기]를 쓰세요.
 *  - 시트에서 assign 줄을 지웠다면(예: TEST 줄 정리) 메뉴 [배정 기록 다시 읽기]를 한 번 눌러 주세요.
 *  - 저장이 실패하거나 '바쁨'이면 페이지가 3·10·30·60초 간격으로 다시 보내요(설문·완료는 서버가 받았다고 답할 때까지).
 *  - 실패 기록은 errors 탭에 남아요. 'busy'가 가끔 보이는 건 괜찮아요(다시 보내서 저장됨).
 */

const CONDS = ['fin-a', 'fin-b', 'fin-c', 'ott-a', 'ott-b', 'ott-c'];
const IN_PROGRESS_MIN = 20;   // 조건 배정 때: 시작 후 이 시간(분) 안의 미완료자는 '진행 중'으로 세어 같은 조건에 몰리지 않게 함
const IDLE_MIN = 30;          // 상태 판정: 마지막 기록 뒤 이 시간(분)이 지나도록 기록이 없으면 '이탈'
const ID_PREFIX = 'RS';       // 참여자 번호 앞 글자: 본실험 v2.0(재설문) = RS001… (사이트 설정의 prefix가 있으면 그걸 씀)
const ID_DIGITS = 3;

const HEAD = {
  assign: ['pid', 'cond', 'status', 'started_at', 'completed', 'completed_at', 'code', 'device_key',
    'last_page', 'last_stage', 'last_screen', 'last_seen'],
  pages: ['received_at', 'pid', 'cond', 'page', 'page_ms', 'answers_json'],
  events: ['pid', 'cond', 'n', 'first_at', 'last_at', 'last_stage', 'last_screen', 'events_1', 'events_2', 'events_3', 'events_4', 'events_5'],   // 참여자당 한 줄 (자기 줄에만 이어 씀 · 칸마다 4만 자)
  events_flat: ['received_at', 'pid', 'cond', 't_ms', 'client_ts', 'type', 'stage', 'screen', 'data_json'],   // 메뉴 '행동 기록 펼치기'로 만드는 한 행동 = 한 줄
  summary: ['pid', 'cond', 'completed_at', 'layout', 'touch', 'screen_w', 'screen_h',
    'home_ms', 'home_taps', 'notice_ms', 'notice_early_taps', 'explore_ms', 'seen', 'carousel_moves',
    'details', 'detail_ms', 'travel_ms', 'info_first_ms', 'info_prompted', 'info_opens', 'info_total_ms',
    'hidden_ms', 'inactive_taps', 'offtask_taps', 'nav_blocked', 'survey_pages', 'resumes',
    'sit1_ms', 'sit2_ms', 'back_navs', 'revisits', 'revisit_ms', 'revisit_pages', 'next_blocked',
    'notice_p1_ms', 'notice_p2_ms', 'notice_p3_ms'],
  errors: ['at', 'error', 'stack', 'payload_head']
};

// 머리글 설명 (칸에 마우스를 올리면 보임)
const NOTE = {
  pid: '참여자 번호 (사전 연구 MS001…, v2.0 파일럿 PL001…, 본실험 v2.0 RS001…, 테스트는 TEST001…)', cond: '배정 조건 (fin=금융, ott=OTT / a=중립, b=본실험 서비스 목적·v2.0 회사 이익, c=본실험 사용자 혜택·v2.0 사용자 이익)',
  started_at: '참여 시작(조건 배정) 시각', completed: '끝까지 마쳤는지 (TRUE/FALSE)', completed_at: '완료 시각',
  code: '완료 코드 (사전검사는 사용 안 함)', device_key: '같은 기기로 다시 들어왔는지 확인하는 무작위 값 (분석에 쓰지 않음)',
  received_at: '시트에 저장된 시각 (한국 시간)', page: '설문 페이지 (본실험: T0=시작 전, T1=추천 탭 후, T2=씽킹트래블 후 / 사전검사: T0, T00a·b, T1, T2a~d)',
  page_ms: '그 설문 페이지에 머문 시간 (밀리초, 1000 = 1초)', answers_json: '그 페이지의 응답 원본',
  t_ms: '참여 시작부터 지난 시간 (밀리초)', client_ts: '참여자 기기의 시각', type: '행동 종류 (예: tap, screen_enter, notice_show)',
  stage: '진행 단계 (home=원 서비스 홈, tab=추천 탭, travel=씽킹트래블, end=종료)', screen: '그때 보고 있던 앱 화면',
  data_json: '행동의 세부 내용 (누른 버튼, 머문 시간 등)', n: '이 참여자의 행동 기록 수', first_at: '첫 행동 기록이 들어온 시각', last_at: '마지막 행동 기록이 들어온 시각', events_1: '행동 기록 (JSON 배열 · 칸이 차면 events_2, events_3 … 으로 이어짐). 한 행동 = 한 줄로 보려면 메뉴 [행동 기록 펼치기]', events_2: '행동 기록 이어서', events_3: '행동 기록 이어서', events_4: '행동 기록 이어서', events_5: '행동 기록 이어서',
  t_from: '묶음 첫 행동의 시각 (참여 시작부터 밀리초)', t_to: '묶음 마지막 행동의 시각 (참여 시작부터 밀리초)',
  events_json: '(예전 형식) 묶음 속 행동 전체', updated_at: '응답이 마지막으로 저장된 시각',
  layout: '화면 방식 (framed=PC에서 폰 틀 안, mobile-full=휴대폰 전체 화면)', touch: '터치 기기 여부',
  screen_w: '브라우저 화면 너비 (px)', screen_h: '브라우저 화면 높이 (px)',
  home_ms: '1단계 홈 화면 탐색 시간 (밀리초)', home_taps: '1단계에서 누른 횟수',
  notice_ms: '고지가 뜬 뒤 닫기까지 걸린 시간 (밀리초) — v2.0(파일럿·본실험)은 3장 안내 전체', notice_early_taps: '고지 [계속하기]를 장마다 3초가 지나기 전에 누른 횟수 (장마다 첫 번째에 \'잠시 후 넘어갈 수 있어요\' 말풍선, 다시 누르면 넘어감)',
  notice_p1_ms: 'v2.0 고지 1장(새 페이지 안내)에 머문 시간 (밀리초)', notice_p2_ms: 'v2.0 고지 2장(★ 목적 문장)에 머문 시간 (밀리초)', notice_p3_ms: 'v2.0 고지 3장(범위 약속)에 머문 시간 (밀리초)',
  explore_ms: '고지 확인 뒤 추천 탭 탐색 시간 (밀리초)', seen: '추천 핵심 3개 중 본 개수', carousel_moves: '추천 카드·포스터를 넘긴 횟수',
  details: '카드·콘텐츠 상세 화면을 연 횟수', detail_ms: '상세 화면에 머문 시간 합계 (밀리초)',
  travel_ms: '씽킹트래블 탐색 시간 (밀리초)', info_first_ms: '씽킹트래블에 들어와서 ⓘ를 처음 누르기까지 (밀리초)',
  info_prompted: 'ⓘ를 힌트가 뜬 뒤에 눌렀는지 (TRUE=힌트 후, FALSE=스스로)', info_opens: 'ⓘ 팝업을 연 횟수',
  info_total_ms: 'ⓘ 팝업을 열어 둔 시간 합계 (밀리초)', hidden_ms: '다른 앱·창으로 나가 있던 시간 합계 (밀리초)',
  inactive_taps: '준비 중인 기능을 누른 횟수', offtask_taps: '2단계에서 탭으로 이동하기 전 다른 곳을 누른 횟수',
  nav_blocked: '그 단계에서 쓸 수 없는 하단 탭을 누른 횟수', survey_pages: '제출한 설문 페이지 수',
  sit1_ms: '상황 1 페이지를 읽은 시간 (밀리초, 본실험)', sit2_ms: '상황 2 페이지를 읽은 시간 (밀리초, 본실험)',
  back_navs: '‹ 버튼(또는 휴대폰 뒤로 가기)으로 이전 화면에 간 횟수 (본실험)', revisits: '이미 지나간 앱·상황 화면을 다시 본 횟수 (본실험)',
  revisit_ms: '지나간 화면을 다시 본 시간 합계 (밀리초, 본실험)', revisit_pages: '다시 본 화면 순서 (예: tab,home)',
  next_blocked: '조건(문항 응답·최소 시간)을 채우기 전에 다음을 눌러 막힌 횟수 (본실험)',
  resumes: '창이 꺼졌다가 같은 기기로 다시 들어와 이어서 진행한 횟수 (0 = 한 번에 완료)',
  status: '진행 상태: 미시작(첫 설문 전) / 진행 중 / 이탈(마지막 기록 뒤 ' + IDLE_MIN + '분 넘게 기록 없음) / 완료',
  last_page: '마지막으로 제출한 설문 페이지 (비어 있으면 첫 설문 전)', last_stage: '마지막 기록 때의 진행 단계',
  last_screen: '마지막 기록 때 보고 있던 화면 (설문 중이면 마지막에 열린 설문 페이지)', last_seen: '마지막 기록 시각',
  at: '오류 시각', error: '오류 내용', stack: '오류 위치', payload_head: '오류가 난 요청 앞부분'
};

function doPost(e) {
  let d = null;
  try { d = JSON.parse(e.postData.contents); } catch (err) { logError_(err, e); return json_({ ok: false, error: 'bad request' }); }
  try {
    let out = { ok: true };
    if (d.kind === 'assign') out = assign_(d);
    else if (d.kind === 'page') savePage_(d);
    else if (d.kind === 'events') saveEventsFree_(d);
    else if (d.kind === 'complete') complete_(d);
    return json_(out);
  } catch (err) {
    const busy = /busy/.test(String(err));
    if (!busy) logError_(err, e);   // '바쁨'은 페이지가 곧 다시 보내므로 errors 탭에 쌓지 않음
    return json_({ ok: false, busy: busy, error: String(err) });
  }
}
// 꼭 한 명씩 해야 하는 아주 짧은 구간만 순서대로 (번호 매기기 · 새 줄 만들기). 못 받으면 '바쁨' → 페이지가 다시 보냄
function withLock_(ms, fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(ms)) throw new Error('busy: lock timeout');
  try { return fn(); } finally { lock.releaseLock(); }
}
// 2행부터 pid(1열)로 줄 번호 찾기 (없으면 -1). 같은 번호가 여럿이면 맨 아래 줄
function findRow_(sh, pid) {
  const n = sh.getLastRow() - 1; if (n < 1 || !pid) return -1;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) if (String(ids[i][0]) === String(pid)) return i + 2;
  return -1;
}

function doGet() { return json_({ ok: true, msg: 'DCC endpoint is running' }); }

/* ---------- 조건 배정 + 참여자 번호 ---------- */
// 조건: ① 완료자가 가장 적은 조건 → ② 그중 진행 중인 사람이 가장 적은 조건 → ③ 그래도 같으면 무작위
// 번호: RS001, RS002 … 순서대로 (테스트는 TEST001 …). 같은 기기로 다시 들어오면 같은 번호·조건
// 몰릴 때를 위해: 번호·인원 계산은 시트를 읽지 않고 스크립트 속성(작은 메모)으로 해서 순서 구간을 아주 짧게 함.
//   처음 한 번만 assign 탭을 읽어 메모를 만들고, 시트에서 줄을 지웠다면 메뉴 [배정 기록 다시 읽기]로 다시 만들어요.
const AC_ = k => HEAD.assign.indexOf(k);
function aRow_(o) { return HEAD.assign.map(k => o[k] === undefined ? '' : o[k]); }
const ST_KEY = 'assign_state_v2';
const ROW_SHEETS = ['assign', 'responses', 'events', 'summary'];   // 새 줄을 '예약'해서 쓰는 탭 (appendRow를 동시에 쓰면 줄이 덮여 사라짐 — 11/27 시험에서 확인)
function loadState_(props) {
  const raw = props.getProperty(ST_KEY);
  if (raw) return JSON.parse(raw);
  const st = { n: {}, done: {}, live: [], rows: {}, max: {} };
  CONDS.forEach(c => { st.done[c] = 0; });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ROW_SHEETS.forEach(name => { const sh = name === 'responses' ? respSheetNoLock_() : sheetNoLock_(name); st.rows[name] = sh.getLastRow() + 1; st.max[name] = sh.getMaxRows(); });
  const sh = ss.getSheetByName('assign'); const H = HEAD.assign; const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, H.length).getValues().forEach(r => {
    const id = String(r[0]); const m = id.match(/^([A-Z]+)(\d+)$/);
    if (m) st.n[m[1]] = Math.max(st.n[m[1]] || 0, Number(m[2]));
    const key = r[AC_('device_key')]; if (key) props.setProperty('k_' + key, id + '|' + r[1]);
    if (/^TEST/.test(id) || !(r[1] in st.done)) return;   // 테스트 기록은 인원 계산에서 뺌
    const c = r[AC_('completed')], s0 = r[AC_('started_at')];
    if (c === true || c === 'TRUE') st.done[r[1]]++;
    else if (s0) st.live.push([r[1], new Date(s0).getTime(), id]);
  });
  return st;
}
// 순서 구간 안에서만 부름: 탭의 다음 빈 줄 번호를 하나 받음 (모자라면 줄을 늘림)
function reserve_(st, name) {
  const row = st.rows[name]; st.rows[name] = row + 1;
  if (row > st.max[name]) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    sh.insertRowsAfter(sh.getMaxRows(), 1000); st.max[name] = sh.getMaxRows();
  }
  return row;
}
// 새 줄 하나 쓰기 (LOCAL 참여자·완료 요약 등): 순서 구간에서 줄 번호만 받고(이미 있으면 그 줄) 쓰기는 밖에서
function newRow_(name, vals, pid) {
  const sh = name === 'responses' ? respSheet_() : sheet_(name);
  const got = withLock_(15000, () => {
    if (pid) { const r0 = findRow_(sh, pid); if (r0 > 0) return { row: r0, had: true }; }
    const props = PropertiesService.getScriptProperties(); const st = loadState_(props);
    const row = reserve_(st, name); props.setProperty(ST_KEY, JSON.stringify(st));
    return { row: row, had: false };
  });
  if (!got.had) sh.getRange(got.row, 1, 1, vals.length).setValues([vals]);
  return got;
}
function assign_(d) {
  const props = PropertiesService.getScriptProperties();
  const isTest = !!d.test;
  const fam = /^[A-Z]{1,4}$/.test(String(d.prefix || '')) ? d.prefix : ID_PREFIX;   // 이 버전의 번호 앞 글자
  const prefix = isTest ? 'TEST' : fam;
  const again = () => { const had = d.key && props.getProperty('k_' + d.key); if (!had) return null; const [pid, cond] = had.split('|'); return { pid: pid, cond: cond, again: true }; };
  const a0 = again(); if (a0) return Object.assign({ ok: true }, a0);
  const at = new Date();
  const r = withLock_(7000, () => {
    const a1 = again(); if (a1) return a1;
    const st = loadState_(props);
    const nowMs = at.getTime();
    st.live = st.live.filter(x => nowMs - x[1] < IN_PROGRESS_MIN * 60000);   // 시작 후 IN_PROGRESS_MIN분 안의 미완료자만 '진행 중'
    const num = (st.n[prefix] || 0) + 1; st.n[prefix] = num;
    const pid = prefix + String(num).padStart(ID_DIGITS, '0');
    const live = {}; CONDS.forEach(c => { live[c] = 0; }); st.live.forEach(x => { if (x[0] in live) live[x[0]]++; });
    const minDone = Math.min.apply(null, CONDS.map(c => st.done[c] || 0));
    let pool = CONDS.filter(c => (st.done[c] || 0) === minDone);
    const minLive = Math.min.apply(null, pool.map(c => live[c]));
    pool = pool.filter(c => live[c] === minLive);
    const cond = pool[Math.floor(Math.random() * pool.length)];
    if (!isTest) st.live.push([cond, nowMs, pid]);
    const rows = { assign: reserve_(st, 'assign'), responses: reserve_(st, 'responses'), events: reserve_(st, 'events') };
    props.setProperty(ST_KEY, JSON.stringify(st));
    if (d.key) props.setProperty('k_' + d.key, pid + '|' + cond);
    return { pid: pid, cond: cond, done: st.done, live: live, rows: rows };
  });
  if (r.again) return Object.assign({ ok: true }, r);
  delete r.again;
  // 예약한 줄에 쓰기 (서로 다른 줄이라 겹치지 않음). responses·events 줄도 미리 만들어 둠 → 이후 저장은 자기 줄만 고침
  const A = aRow_({ pid: r.pid, cond: r.cond, status: '미시작', started_at: at, completed: false, device_key: d.key || '', last_seen: at });
  sheet_('assign').getRange(r.rows.assign, 1, 1, A.length).setValues([A]);
  respSheet_().getRange(r.rows.responses, 1, 1, 3).setValues([[r.pid, r.cond, at]]);
  sheet_('events').getRange(r.rows.events, 1, 1, 5).setValues([[r.pid, r.cond, 0, '', '']]);
  return { ok: true, pid: r.pid, cond: r.cond, done: r.done, live: r.live };
}
// 완료자 수 +1 (조건 배정용 메모)
function markDone_(pid, cond) {
  try {
    withLock_(10000, () => {
      const props = PropertiesService.getScriptProperties(); const st = loadState_(props);
      st.done[cond] = (st.done[cond] || 0) + 1; st.live = st.live.filter(x => x[2] !== pid);
      props.setProperty(ST_KEY, JSON.stringify(st));
    });
  } catch (err) { logError_(err); }
}
// 테스트 기록 지우기: pid가 TEST로 시작하거나 LOCAL-LOADT(몰림 시험)인 줄을 모든 탭에서 지우고 배정 메모를 다시 만듦
//   KEEP_TEST에 적은 번호는 남겨요. 예전 묶음 형식 events 줄은 참여자당 한 줄로 바꾸고, 시험용 열(T0_lt0 등)은 지워요.
const KEEP_TEST = ['TEST001'];
function clearTestRows() {
  const isTest = id => (/^TEST/.test(String(id)) && KEEP_TEST.indexOf(String(id)) < 0) || /^LOCAL-LOADT/.test(String(id));
  const ss = SpreadsheetApp.getActiveSpreadsheet(); const out = [];
  withLock_(60000, () => {
    ['assign', 'pages', 'responses', 'summary', 'events', 'events_flat'].forEach(name => {
      const sh = ss.getSheetByName(name); if (!sh) return;
      const n = sh.getLastRow() - 1, w = sh.getLastColumn(); if (n < 1) return;
      const head = sh.getRange(1, 1, 1, w).getValues()[0].map(String);
      const rows = sh.getRange(2, 1, n, w).getValues();
      if (name === 'events' && head[0] === 'received_at') { const m = migrateOldEvents_(sh, isTest); out.push('events ' + (m.before) + '줄 → 참여자당 한 줄 ' + m.after + '줄'); return; }
      const col = (name === 'pages' || name === 'events_flat') ? 1 : 0;   // pid 열
      const keep = rows.filter(r => r[col] !== '' && !isTest(r[col]));
      const junk = head.map((h, i) => /_lt\d+$/.test(h) ? i : -1).filter(i => i >= 0);   // 시험용 열
      if (keep.length === rows.length && !junk.length) return;
      sh.getRange(2, 1, n, w).clearContent();
      if (keep.length) sh.getRange(2, 1, keep.length, w).setValues(keep);
      if (n > keep.length) sh.getRange(2 + keep.length, 1, n - keep.length, w).clearFormat();   // 지운 줄의 상태 색 등
      junk.reverse().forEach(i => sh.deleteColumn(i + 1));
      out.push(name + ' ' + (rows.length - keep.length) + '줄' + (junk.length ? ' · 시험용 열 ' + junk.length + '개' : ''));
    });
  });
  resetAssignState(); try { refreshStatus(); } catch (_) {}
  try { SpreadsheetApp.getActive().toast(out.length ? '정리: ' + out.join(', ') : '지울 테스트 기록이 없어요.', '연구 도구', 10); } catch (_) {}
  return out;
}
// 시트에서 줄을 지운 뒤(예: TEST 줄 정리) 배정 메모를 assign 탭 기준으로 다시 만듦
function resetAssignState() {
  withLock_(30000, () => {
    const props = PropertiesService.getScriptProperties();
    Object.keys(props.getProperties()).forEach(k => { if (/^assign_state_/.test(k) || /^k_/.test(k)) props.deleteProperty(k); });
    CacheService.getScriptCache().removeAll(['resp_hdr'].concat(ROW_SHEETS.map(n => 'hdr2_' + n)));
    props.setProperty(ST_KEY, JSON.stringify(loadState_(props)));
  });
  try { SpreadsheetApp.getActive().toast('assign 탭 기준으로 배정 기록을 다시 읽었어요.', '연구 도구', 5); } catch (_) {}
}

/* ---------- 설문 페이지 ---------- */
// 순서 대기 없이 저장: 배정 때 만든 responses 자기 줄의 그 페이지 칸만 고침 (페이지 체류 시간은 {페이지}_ms 열)
// pages 탭(예전 제출 기록)은 쓰지 않아요 — 동시에 줄을 추가하면 덮여서 사라지기 때문
function savePage_(d) {
  ensureLocalRow_(d);
  const ans = Object.assign({}, d.answers || {});
  if (d.page && d.page !== 'recover' && d.page_ms !== undefined) ans[d.page + '_ms'] = d.page_ms;
  saveResponses_(Object.assign({}, d, { answers: ans }));
  touchCells_(d.pid, { last_page: d.page, last_screen: 'survey:' + d.page }, true);
}

// responses: 참여자당 한 줄, 문항마다 한 열. 문항 칸에는 문항 문구가 설명으로 붙어요.
function respSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('responses');
  if (sh && sh.getLastRow() > 0) return sh;
  return withLock_(15000, respSheetNoLock_);
}
function respSheetNoLock_() {   // 순서 구간 안에서 부름
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('responses') || ss.insertSheet('responses');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 3).setValues([['pid', 'cond', 'updated_at']]);
    sh.getRange(1, 1, 1, 3).setNotes([[NOTE.pid, NOTE.cond, NOTE.updated_at]]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function respHeader_(sh, fresh) {
  const c = CacheService.getScriptCache();
  if (!fresh) { const h = c.get('resp_hdr'); if (h) return JSON.parse(h); }
  const n = sh.getLastColumn(); const h = n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
  c.put('resp_hdr', JSON.stringify(h), 21600);
  return h;
}
function saveResponses_(d) {
  const keys = Object.keys(d.answers || {}); if (!keys.length) return;
  const sh = respSheet_();
  let header = respHeader_(sh);
  if (keys.some(k => header.indexOf(k) < 0)) header = respHeader_(sh, true);   // 다른 사람이 방금 만든 열일 수 있으니 먼저 다시 읽기
  if (keys.some(k => header.indexOf(k) < 0)) {   // 새 문항 열: 한 명만 만들도록 순서대로
    header = withLock_(15000, () => {
      let h = respHeader_(sh, true);
      const add = keys.filter(k => h.indexOf(k) < 0);
      if (add.length) {
        sh.getRange(1, h.length + 1, 1, add.length).setValues([add]);
        const labels = d.labels || {};
        sh.getRange(1, h.length + 1, 1, add.length).setNotes([add.map(k => labels[k] || '')]);
        h = h.concat(add);
        CacheService.getScriptCache().put('resp_hdr', JSON.stringify(h), 21600);
      }
      return h;
    });
  }
  let row = findRow_(sh, d.pid);
  if (row < 0) row = newRow_('responses', [d.pid, d.cond, new Date()], d.pid).row;   // 배정 줄이 없는 참여자(LOCAL 등)
  const cols = keys.map(k => header.indexOf(k)).filter(c => c >= 0);
  const a = Math.min.apply(null, cols), z = Math.max.apply(null, cols);
  const rng = sh.getRange(row, a + 1, 1, z - a + 1);   // 이 페이지 문항이 있는 칸만 (다른 페이지 칸은 건드리지 않음)
  const cur = rng.getValues()[0];
  keys.forEach(k => { const c = header.indexOf(k); if (c >= 0) cur[c - a] = d.answers[k]; });
  rng.setValues([cur]);
  sh.getRange(row, 3).setValue(new Date());
}

/* ---------- 행동 기록 ---------- */
function saveEvents_(d) { saveEventsFree_(d); }

/* ---------- 완료: assign 갱신 + summary 한 줄 ---------- */
function complete_(d) {
  const sh = sheet_('assign');
  let row = findRow_(sh, d.pid), first = false;
  if (row < 0) {
    const g = newRow_('assign', aRow_({ pid: d.pid, cond: d.cond, status: '완료', completed: true, completed_at: new Date(), code: d.code || '', last_seen: new Date() }), d.pid);
    if (g.had) row = g.row; else { first = true; row = -2; }
  }
  if (row > 0) {
    const cc = AC_('completed') + 1;   // completed · completed_at · code는 붙어 있음
    const was = sh.getRange(row, cc, 1, 2).getValues()[0];   // 이미 완료로 기록돼 있으면 처음 완료 시각을 그대로 둠 (복구 전송 때문)
    const already = was[0] === true || was[0] === 'TRUE';
    first = !already;
    sh.getRange(row, cc, 1, 3).setValues([[true, already && was[1] ? was[1] : new Date(), d.code || '']]);
    sh.getRange(row, AC_('status') + 1).setValue('완료');
  }
  touchCells_(d.pid, { last_stage: 'end', last_screen: 'end' });
  if (first && !/^TEST/.test(String(d.pid)) && CONDS.indexOf(d.cond) >= 0) markDone_(d.pid, d.cond);

  const m = d.metrics || {}, dev = d.device || {};
  const S = sheet_('summary');
  const vals = HEAD.summary.map(h => {
    if (h === 'pid') return d.pid;
    if (h === 'cond') return d.cond;
    if (h === 'completed_at') return new Date();
    if (h === 'layout') return dev.layout || '';
    if (h === 'touch') return dev.touch === undefined ? '' : dev.touch;
    if (h === 'screen_w') return dev.vw || '';
    if (h === 'screen_h') return dev.vh || '';
    return m[h] === undefined || m[h] === null ? '' : m[h];
  });
  const j = findRow_(S, d.pid);
  if (j > 0) S.getRange(j, 1, 1, vals.length).setValues([vals]);
  else { const g = newRow_('summary', vals, d.pid); if (g.had) S.getRange(g.row, 1, 1, vals.length).setValues([vals]); }
}

// 서버 배정에 실패한 LOCAL 참여자: 첫 기록이 들어올 때 assign에 줄을 만들어 둠 (started_at = 첫 설문 제출 시각)
function ensureLocalRow_(d) {
  if (!/^LOCAL-/.test(String(d.pid || '')) || CONDS.indexOf(d.cond) < 0) return;
  const sh = sheet_('assign');
  if (findRow_(sh, d.pid) > 0) return;
  const at = new Date();
  newRow_('assign', aRow_({ pid: d.pid, cond: d.cond, status: '미시작', started_at: at, completed: false, last_seen: at }), d.pid);
}

/* ---------- 진행 상태 (assign) ---------- */
const STATUS_COLOR = { '미시작': '#f1f3f4', '진행 중': '#e8f0fe', '이탈': '#fce8e6', '완료': '#e6f4ea' };
// 참여자 한 명의 마지막 위치를 갱신 (status는 refreshStatus_가 계산)
// 행동 목록을 칸마다 4만 자 이하로 나눠 row[j]부터 채움 (구글 시트 칸은 5만 자까지). 마지막 칸을 넘으면 나머지는 버림
function packEvents_(row, j, cN, evs) {
  const cells = []; let cur = [], len = 2;
  evs.forEach(ev => { const n = JSON.stringify(ev).length + 1; if (cur.length && len + n > 40000) { cells.push(cur); cur = []; len = 2; } cur.push(ev); len += n; });
  if (cur.length) cells.push(cur);
  cells.forEach((c, k) => { if (j + k <= cN) row[j + k] = JSON.stringify(c); });
}
// 행동 기록: 배정 때 만든 events 자기 줄에 이어 씀 (칸이 4만 자를 넘으면 다음 칸) — 순서 대기 없음
function saveEventsFree_(d) {
  const evs = d.events || []; if (!evs.length || !d.pid) return;
  const sh = sheet_('events'), H = HEAD.events, now = new Date();
  let row = findRow_(sh, d.pid);
  if (row < 0) row = newRow_('events', [d.pid, d.cond, 0, '', ''], d.pid).row;   // LOCAL 참여자 등
  const cur = sh.getRange(row, 1, 1, H.length).getValues()[0];
  const c0 = H.indexOf('events_1'), cN = H.length - 1;
  let j = c0; for (let c = cN; c >= c0; c--) if (cur[c] !== '' && cur[c] !== null) { j = c; break; }
  let arr = []; try { arr = cur[j] ? JSON.parse(cur[j]) : []; } catch (_) { arr = []; }
  packEvents_(cur, j, cN, arr.concat(evs));
  cur[H.indexOf('n')] = (Number(cur[H.indexOf('n')]) || 0) + evs.length;
  if (!cur[H.indexOf('first_at')]) cur[H.indexOf('first_at')] = now;
  cur[H.indexOf('last_at')] = now;
  const last = evs[evs.length - 1];
  const scr = /^survey_/.test(last.type) && last.page ? 'survey:' + last.page : (last.screen || '');   // 설문 중이면 설문 페이지 이름
  cur[H.indexOf('last_stage')] = last.stage || ''; cur[H.indexOf('last_screen')] = scr;
  sh.getRange(row, 1, 1, H.length).setValues([cur]);
  touchCells_(d.pid, { last_stage: last.stage || '', last_screen: scr });
}
// 행 전체를 다시 쓰지 않고 필요한 칸만 씀 (잠금 없이 써도 완료 표시 등을 덮어쓰지 않게)
function touchCells_(pid, vals, prog) {
  const sh = sheet_('assign'); const H = HEAD.assign;
  const row = findRow_(sh, pid); if (row < 0) return;
  const w = {}; Object.keys(vals).forEach(k => { const c = H.indexOf(k); if (c >= 0 && vals[k] !== undefined) w[c] = vals[k]; });
  w[H.indexOf('last_seen')] = new Date();
  const cols = Object.keys(w).map(Number).sort((a, b) => a - b), a0 = cols[0], z0 = cols[cols.length - 1];
  if (z0 - a0 + 1 === cols.length) sh.getRange(row, a0 + 1, 1, cols.length).setValues([cols.map(c => w[c])]);   // last_page~last_seen은 붙어 있어 한 번에
  else cols.forEach(c => sh.getRange(row, c + 1).setValue(w[c]));
  if (prog) {   // 설문을 냈으면 '진행 중' (완료자는 그대로)
    const st = H.indexOf('status'), cc = H.indexOf('completed');
    const v = sh.getRange(row, st + 1, 1, cc - st + 1).getValues()[0];
    const done = v[cc - st] === true || v[cc - st] === 'TRUE';
    if (!done && v[0] !== '진행 중') sh.getRange(row, st + 1).setValue('진행 중');
  }
}
function touch_(pid, vals) {
  const sh = sheet_('assign'); const H = HEAD.assign;
  const n = sh.getLastRow() - 1; if (n < 1 || !pid) return;
  const ids = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(pid)); if (i < 0) return;
  const row = i + 2;
  const cur = sh.getRange(row, 1, 1, H.length).getValues()[0];
  const st = H.indexOf('status'), done = cur[H.indexOf('completed')] === true || cur[H.indexOf('completed')] === 'TRUE';
  Object.keys(vals).forEach(k => { const c = H.indexOf(k); if (c >= 0 && vals[k] !== undefined) cur[c] = vals[k]; });
  if (done) cur[st] = '완료';   // 완료자는 늦게 온 설문·복구 전송이 와도 완료 그대로
  cur[H.indexOf('last_seen')] = new Date();
  sh.getRange(row, 1, 1, H.length).setValues([cur]);
}
function statusOf_(r, H, nowMs) {
  const done = r[H.indexOf('completed')] === true || r[H.indexOf('completed')] === 'TRUE';
  if (done) return '완료';
  if (!r[H.indexOf('last_page')]) return '미시작';
  const seen = r[H.indexOf('last_seen')] || r[H.indexOf('started_at')];
  const t = seen ? new Date(seen).getTime() : 0;
  return t && nowMs - t < IDLE_MIN * 60000 ? '진행 중' : '이탈';
}
function refreshStatus_() {
  const sh = sheet_('assign'); const H = HEAD.assign;
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const rows = sh.getRange(2, 1, n, H.length).getValues();
  const nowMs = Date.now(), c = H.indexOf('status') + 1;
  const st = rows.map(r => [statusOf_(r, H, nowMs)]);
  sh.getRange(2, c, n, 1).setValues(st).setBackgrounds(st.map(s => [STATUS_COLOR[s[0]] || null]));
}
function refreshStatusSoon_() {
  const c = CacheService.getScriptCache();
  if (c.get('status_at')) return;
  c.put('status_at', '1', 60);
  refreshStatus_();
}
function refreshStatus() { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { refreshStatus_(); } finally { lock.releaseLock(); } }
// pages·events 탭을 처음부터 읽어 모든 참여자의 마지막 위치를 다시 채움 (예전 기록에도 상태를 붙일 때)
function rebuildStatus() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = sheet_('assign'); const H = HEAD.assign;
    const n = sh.getLastRow() - 1; if (n < 1) return;
    const rows = sh.getRange(2, 1, n, H.length).getValues();
    const info = {};
    const rs = respSheet_(); const rh = respHeader_(rs, true); const rn = rs.getLastRow() - 1;
    if (rn > 0) rs.getRange(2, 1, rn, rh.length).getValues().forEach(r => {
      const o = info[r[0]] = info[r[0]] || {};
      ['T0', 'T1', 'T2'].forEach(pgId => { const c = rh.indexOf(pgId + '_ms'); if (c >= 0 && r[c] !== '') o.last_page = pgId; });
      if (r[2] && (!o.seen || r[2] > o.seen)) o.seen = r[2];
    });
    const ev = sheet_('events'); const EH = HEAD.events; const en = ev.getLastRow() - 1;
    if (en > 0) ev.getRange(2, 1, en, EH.length).getValues().forEach(r => {
      if (!r[0]) return; const o = info[r[0]] = info[r[0]] || {};
      o.last_stage = r[EH.indexOf('last_stage')]; o.last_screen = r[EH.indexOf('last_screen')];
      const at = r[EH.indexOf('last_at')]; if (at && (!o.seen || at > o.seen)) o.seen = at;
    });
    rows.forEach(r => {
      const o = info[r[0]]; if (!o) return;
      if (o.last_page) r[H.indexOf('last_page')] = o.last_page;
      if (o.last_stage !== undefined) r[H.indexOf('last_stage')] = o.last_stage;
      if (o.last_screen !== undefined) r[H.indexOf('last_screen')] = o.last_screen;
      if (o.seen) r[H.indexOf('last_seen')] = o.seen;
    });
    sh.getRange(2, 1, n, H.length).setValues(rows);
    refreshStatus_();
  } finally { lock.releaseLock(); }
}
function installStatusTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshStatus').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshStatus').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getActive().toast('10분마다 상태를 새로고침해요.', '연구 도구', 5);
}

/* ---------- 시트 메뉴: events 참여자별 정리 ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('연구 도구')
    .addItem('상태 새로고침', 'refreshStatus')
    .addItem('상태 다시 계산 (전체 · 예전 기록 포함)', 'rebuildStatus')
    .addItem('상태 자동 새로고침 켜기 (10분마다)', 'installStatusTrigger')
    .addItem('배정 기록 다시 읽기 (시트에서 줄을 지운 뒤)', 'resetAssignState')
    .addItem('테스트 기록 지우기 (TEST · LOCAL-LOADT 줄)', 'clearTestRows')
    .addSeparator()
    .addItem('행동 기록 펼치기 (events → events_flat, 한 행동 한 줄 · 참여자별 접기)', 'flattenEvents')
    .addItem('events_flat 접힌 줄 모두 열기', 'expandEvents')
    .addToUi();
}
// events(묶음 한 줄)를 펼쳐 events_flat 탭에 한 행동 = 한 줄로 다시 씀 (참여자 번호 → 시간 순, 중복 전송은 한 번만)
// 수집 중에 실행해도 돼요. 실행할 때마다 events_flat을 처음부터 다시 만들어요.
function flattenEvents() {
  const src = sheet_('events'), H = HEAD.events, n0 = src.getLastRow() - 1;
  const out = [], seen = {};
  const push = (at, pid, cond, ev) => {
    const key = pid + '|' + ev.t + '|' + ev.type + '|' + ev.ts; if (seen[key]) return; seen[key] = 1;
    const rest = {}; Object.keys(ev).forEach(k => { if (['t', 'ts', 'type', 'stage', 'screen'].indexOf(k) < 0) rest[k] = ev[k]; });
    out.push([at, pid, cond, ev.t, ev.ts, ev.type, ev.stage, ev.screen, JSON.stringify(rest)]);
  };
  if (n0 > 0) src.getRange(2, 1, n0, H.length).getValues().forEach(r => {
    if (!r[0]) return;
    for (let c = H.indexOf('events_1'); c < H.length; c++) { let arr = []; try { arr = r[c] ? JSON.parse(r[c]) : []; } catch (_) {} arr.forEach(ev => push(r[H.indexOf('last_at')], r[0], r[1], ev)); }
  });
  out.sort((a, b) => String(a[1]) < String(b[1]) ? -1 : String(a[1]) > String(b[1]) ? 1 : a[3] - b[3]);
  const sh = sheet_('events_flat');
  removeGroups_(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 9).clearContent();
  for (let i = 0; i < out.length; i += 5000) { const part = out.slice(i, i + 5000); sh.getRange(i + 2, 1, part.length, 9).setValues(part); }
  organizeEvents_(sh, out.length);
  SpreadsheetApp.getActive().toast('행동 ' + out.length + '개를 events_flat에 펼쳤어요.', '연구 도구', 5);
}
// 참여자마다 첫 줄만 보이게 나머지를 접어요.
function organizeEvents_(sh, n) {
  if (n >= 2) {
    const pids = sh.getRange(2, 2, n, 1).getValues().map(r => String(r[0]));
    sh.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
    let start = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || pids[i] !== pids[start]) {
        const len = i - start;
        if (len > 1) {
          const g = sh.getRange(start + 3, 1, len - 1, 1);   // 참여자의 첫 줄(start+2) 아래부터 묶음
          g.shiftRowGroupDepth(1);
          sh.getRowGroup(start + 3, 1).collapse();
        }
        start = i;
      }
    }
  }
}
function expandEvents() { const sh = sheet_('events_flat'); sh.expandAllRowGroups(); }
function removeGroups_(sh) {
  const n = sh.getMaxRows();
  try { sh.expandAllRowGroups(); } catch (_) {}
  for (let k = 0; k < 8; k++) { try { sh.getRange(1, 1, n, 1).shiftRowGroupDepth(-1); } catch (_) { break; } }
}

/* ---------- 도구 ---------- */
function logError_(err, e) {
  try {
    sheet_('errors').appendRow([new Date(), String(err), String(err && err.stack || ''), String(e && e.postData && e.postData.contents || '').replace(/"END_phone":"[^"]*"/g, '"END_phone":"(가림)"').slice(0, 500)]);
  } catch (_) {}
}
// 탭이 없으면 만들고, 머리글(1행)이 없거나 모자라면 채우고, 설명(메모)을 붙여요.
function sheet_(name) {
  const header = HEAD[name];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cache = CacheService.getScriptCache();
  let sh = ss.getSheetByName(name);
  if (sh && cache.get('hdr2_' + name)) return sh;   // 몰릴 때 부담을 줄이려고 머리글 확인은 10분에 한 번
  if (!sh) sh = withLock_(15000, () => sheetNoLock_(name));
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  } else {
    const first = sh.getRange(1, 1, 1, header.length).getValues()[0].map(String);
    if (name === 'events' && first[0] === 'received_at') {   // 예전 형식이면 한 명만 바꾸도록
      withLock_(30000, () => { if (String(sh.getRange(1, 1).getValue()) === 'received_at') migrateOldEvents_(sh); });
      cache.put('hdr2_' + name, '1', 600); return sh;
    }
    if (first[0] !== header[0]) { sh.insertRowBefore(1); sh.getRange(1, 1, 1, header.length).setValues([header]); }
    else if (first.join('|') !== header.join('|')) sh.getRange(1, 1, 1, header.length).setValues([header]);
    else if (sh.getRange(1, 1).getNote()) { cache.put('hdr2_' + name, '1', 600); return sh; }   // 머리글·설명이 이미 있으면 그대로
  }
  sh.getRange(1, 1, 1, header.length).setNotes([header.map(h => NOTE[h] || '')]).setFontWeight('bold');
  sh.setFrozenRows(1);
  cache.put('hdr2_' + name, '1', 600);
  return sh;
}
// 예전 events(묶음 한 줄) 형식을 참여자당 한 줄로 바꿈 — 순서 구간 안에서 부름
function migrateOldEvents_(sh, dropId) {
  const n = sh.getLastRow() - 1, w0 = sh.getLastColumn(); const H = HEAD.events;
  const rows = n > 0 ? sh.getRange(2, 1, n, w0).getValues() : [];
  const by = {}, order = [];
  rows.forEach(r => { if (!r[1] || (dropId && dropId(r[1]))) return;
    let o = by[r[1]]; if (!o) { o = by[r[1]] = { cond: r[2], evs: [], first: r[0], last: r[0], st: r[6], sc: r[7] }; order.push(r[1]); }
    try { o.evs = o.evs.concat(JSON.parse(r[8] || '[]')); } catch (_) {}
    if (r[0] >= o.last) { o.last = r[0]; o.st = r[6]; o.sc = r[7]; } });
  const w = Math.max(w0, H.length);
  const out = order.map(pid => { const o = by[pid]; const row = [pid, o.cond, o.evs.length, o.first, o.last, o.st, o.sc]; while (row.length < w) row.push(''); packEvents_(row, H.indexOf('events_1'), H.length - 1, o.evs); return row; });
  sh.getRange(1, 1, Math.max(n, 0) + 1, w).clearContent();
  sh.getRange(1, 1, 1, H.length).setValues([H]); sh.getRange(1, 1, 1, H.length).setNotes([H.map(h => NOTE[h] || '')]).setFontWeight('bold');
  if (out.length) sh.getRange(2, 1, out.length, w).setValues(out);
  return { before: rows.length, after: out.length };
}
function sheetNoLock_(name) {   // 순서 구간 안에서 부름: 탭이 없으면 만들고 머리글을 씀
  const ss = SpreadsheetApp.getActiveSpreadsheet(); const header = HEAD[name];
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, header.length).setValues([header]); sh.getRange(1, 1, 1, header.length).setNotes([header.map(h => NOTE[h] || '')]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
