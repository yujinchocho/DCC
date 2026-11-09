/**
 * DCC 실험 — 응답·행동 기록 저장소 (Google Apps Script)
 *
 * 설치
 *  1. 연구 버전마다 구글 시트를 따로 하나씩 만들어요. (사전검사용 시트 / 본실험용 시트)
 *  2. 시트 메뉴 [확장 프로그램 → Apps Script]를 열고, 이 파일 내용을 전부 붙여넣고 저장해요.
 *  3. [배포 → 새 배포 → 유형: 웹 앱]  실행 사용자: 나 / 액세스 권한: 모든 사용자 → '웹 앱 URL'(…/exec) 복사
 *  코드를 고친 뒤에는 [배포 관리 → 연필(수정) → 버전: 새 버전 → 배포]로 다시 배포해야 반영돼요. (주소는 그대로예요)
 *
 * 시트 탭 (데이터가 들어올 때 자동으로 만들어져요. 탭 순서는 바꿔도 되지만 탭 이름은 바꾸지 마세요)
 *  - assign    : 참여자 번호, 배정 조건, 시작·완료 시각, 진행 상태(미시작/진행 중/이탈/완료)와 마지막 위치
 *  - summary   : 끝까지 마친 참여자의 행동 지표 요약 (참여자당 한 줄)
 *  - responses : 설문 응답 (참여자당 한 줄, 문항마다 한 열. 열 이름은 시점_문항번호, 예: T0_q9, T2_q14_1)
 *  - pages     : 설문 페이지 제출 기록 (페이지별 응답 시간)
 *  - events    : 행동 기록 (이벤트당 한 줄). 메뉴 [연구 도구 → 참여자별로 정리]로 참여자별 접기
 *  - errors    : 저장 중 오류가 나면 내용이 남아요 (정상이면 생기지 않아요)
 * 머리글(1행) 칸에 마우스를 올리면 한글 설명이 보여요.
 *
 * 진행 상태 (assign의 status 열) — 기록이 들어올 때마다 전체를 다시 계산해요
 *  - 미시작 : 동의·배정은 했지만 첫 설문 페이지를 아직 내지 않음 (자극을 보기 전)
 *  - 진행 중: 첫 설문은 냈고, 마지막 기록이 IDLE_MIN분 안에 있음
 *  - 이탈   : 첫 설문은 냈지만, 마지막 기록 뒤 IDLE_MIN분 넘게 아무 기록이 없음
 *  - 완료   : 마무리 화면까지 도착
 *  기록이 안 들어오는 동안에도 '진행 중 → 이탈'이 바뀌게 하려면 메뉴 [연구 도구 → 상태 자동 새로고침 켜기]를 한 번 눌러 주세요.
 *  예전 기록의 마지막 위치를 채우려면 [연구 도구 → 상태 다시 계산 (전체)]를 누르면 돼요.
 */

const CONDS = ['fin-a', 'fin-b', 'fin-c', 'ott-a', 'ott-b', 'ott-c'];
const IN_PROGRESS_MIN = 20;   // 조건 배정 때: 시작 후 이 시간(분) 안의 미완료자는 '진행 중'으로 세어 같은 조건에 몰리지 않게 함
const IDLE_MIN = 30;          // 상태 판정: 마지막 기록 뒤 이 시간(분)이 지나도록 기록이 없으면 '이탈'
const ID_PREFIX = 'SS';       // 참여자 번호 앞 글자 기본값 (사이트 설정의 prefix가 있으면 그걸 씀. 예: 재검사 RT001…)
const ID_DIGITS = 3;

const HEAD = {
  assign: ['pid', 'cond', 'started_at', 'completed', 'completed_at', 'code', 'device_key',
    'status', 'last_page', 'last_stage', 'last_screen', 'last_seen'],
  pages: ['received_at', 'pid', 'cond', 'page', 'page_ms', 'answers_json'],
  events: ['received_at', 'pid', 'cond', 't_ms', 'client_ts', 'type', 'stage', 'screen', 'data_json'],
  summary: ['pid', 'cond', 'completed_at', 'layout', 'touch', 'screen_w', 'screen_h',
    'home_ms', 'home_taps', 'notice_ms', 'notice_early_taps', 'explore_ms', 'seen', 'carousel_moves',
    'details', 'detail_ms', 'travel_ms', 'info_first_ms', 'info_prompted', 'info_opens', 'info_total_ms',
    'hidden_ms', 'inactive_taps', 'offtask_taps', 'nav_blocked', 'survey_pages', 'resumes',
    'sit1_ms', 'sit2_ms', 'back_navs', 'revisits', 'revisit_ms', 'revisit_pages', 'next_blocked'],
  errors: ['at', 'error', 'stack', 'payload_head']
};

// 머리글 설명 (칸에 마우스를 올리면 보임)
const NOTE = {
  pid: '참여자 번호 (SS001…, 테스트는 TEST001…)', cond: '배정 조건 (fin=금융, ott=OTT / a=중립, b=서비스 목적, c=사용자 혜택)',
  started_at: '참여 시작(조건 배정) 시각', completed: '끝까지 마쳤는지 (TRUE/FALSE)', completed_at: '완료 시각',
  code: '완료 코드 (사전검사는 사용 안 함)', device_key: '같은 기기로 다시 들어왔는지 확인하는 무작위 값 (분석에 쓰지 않음)',
  received_at: '시트에 저장된 시각 (한국 시간)', page: '설문 페이지 (본실험: T0=시작 전, T1=추천 탭 후, T2=씽킹트래블 후 / 사전검사: T0, T00a·b, T1, T2a~d)',
  page_ms: '그 설문 페이지에 머문 시간 (밀리초, 1000 = 1초)', answers_json: '그 페이지의 응답 원본',
  t_ms: '참여 시작부터 지난 시간 (밀리초)', client_ts: '참여자 기기의 시각', type: '행동 종류 (예: tap, screen_enter, notice_show)',
  stage: '진행 단계 (home=원 서비스 홈, tab=추천 탭, travel=씽킹트래블, end=종료)', screen: '그때 보고 있던 앱 화면',
  data_json: '행동의 세부 내용 (누른 버튼, 머문 시간 등)', updated_at: '응답이 마지막으로 저장된 시각',
  layout: '화면 방식 (framed=PC에서 폰 틀 안, mobile-full=휴대폰 전체 화면)', touch: '터치 기기 여부',
  screen_w: '브라우저 화면 너비 (px)', screen_h: '브라우저 화면 높이 (px)',
  home_ms: '1단계 홈 화면 탐색 시간 (밀리초)', home_taps: '1단계에서 누른 횟수',
  notice_ms: '고지가 뜬 뒤 확인을 누르기까지 걸린 시간 (밀리초)', notice_early_taps: '확인 버튼이 잠긴 동안 누른 횟수',
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
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    let out = { ok: true };
    if (d.kind === 'assign') out = assign_(d);
    else if (d.kind === 'page') savePage_(d);
    else if (d.kind === 'events') saveEvents_(d);
    else if (d.kind === 'complete') complete_(d);
    try { refreshStatus_(); } catch (err2) { logError_(err2, e); }
    return json_(out);
  } catch (err) {
    logError_(err, e);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return json_({ ok: true, msg: 'DCC endpoint is running' }); }

/* ---------- 조건 배정 + 참여자 번호 ---------- */
// 조건: ① 완료자가 가장 적은 조건 → ② 그중 진행 중인 사람이 가장 적은 조건 → ③ 그래도 같으면 무작위
// 번호: SS001, SS002 … 순서대로 (테스트는 TEST001 …). 같은 기기로 다시 들어오면 같은 번호·조건
function assign_(d) {
  const sh = sheet_('assign');
  const H = HEAD.assign;
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues() : [];
  if (d.key) {
    const mine = rows.find(r => r[6] === d.key);
    if (mine) return { ok: true, pid: mine[0], cond: mine[1], again: true };
  }
  const fam = /^[A-Z]{1,4}$/.test(String(d.prefix || '')) ? d.prefix : ID_PREFIX;   // 이 버전의 번호 앞 글자
  const prefix = d.test ? 'TEST' : fam;
  let maxN = 0;
  rows.forEach(r => {
    const m = String(r[0]).match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) maxN = Math.max(maxN, Number(m[1]));
  });
  const pid = prefix + String(maxN + 1).padStart(ID_DIGITS, '0');

  const now = Date.now(), done = {}, live = {};
  CONDS.forEach(c => { done[c] = 0; live[c] = 0; });
  rows.forEach(r => {
    const id = String(r[0]);
    if (!(r[1] in done) || /^TEST/.test(id)) return;   // 테스트 기록은 인원 계산에서 뺌
    const isFam = new RegExp('^' + fam + '\\d+$').test(id);   // 같은 앞 글자(같은 버전)
    const isLocal = /^LOCAL-/.test(id);                        // 서버 배정에 실패해 브라우저가 조건을 정한 참여자도 셈
    if (!isFam && !isLocal) return;
    if (r[3] === true || r[3] === 'TRUE') done[r[1]]++;
    else if (r[2] && now - new Date(r[2]).getTime() < IN_PROGRESS_MIN * 60000) live[r[1]]++;
  });
  const minDone = Math.min.apply(null, CONDS.map(c => done[c]));
  let pool = CONDS.filter(c => done[c] === minDone);
  const minLive = Math.min.apply(null, pool.map(c => live[c]));
  pool = pool.filter(c => live[c] === minLive);
  const cond = pool[Math.floor(Math.random() * pool.length)];
  const at = new Date();
  sh.appendRow([pid, cond, at, false, '', '', d.key || '', '미시작', '', '', '', at]);
  return { ok: true, pid: pid, cond: cond, done: done, live: live };
}

/* ---------- 설문 페이지 ---------- */
function savePage_(d) {
  ensureLocalRow_(d);
  sheet_('pages').appendRow([new Date(), d.pid, d.cond, d.page, d.page_ms, JSON.stringify(d.answers)]);
  saveResponses_(d);
  touch_(d.pid, { last_page: d.page, last_screen: 'survey:' + d.page });
}

// responses: 참여자당 한 줄, 문항마다 한 열. 문항 칸에는 문항 문구가 설명으로 붙어요.
function saveResponses_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('responses') || ss.insertSheet('responses');
  const base = ['pid', 'cond', 'updated_at'];
  const lastCol = sh.getLastColumn();
  let header = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (header[0] !== 'pid') {
    header = base.concat(header.filter(h => h && base.indexOf(h) < 0));
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.getRange(1, 1, 1, 3).setNotes([[NOTE.pid, NOTE.cond, NOTE.updated_at]]);
    sh.setFrozenRows(1);
  }
  const keys = Object.keys(d.answers || {});
  const add = keys.filter(k => header.indexOf(k) < 0);
  if (add.length) {
    sh.getRange(1, header.length + 1, 1, add.length).setValues([add]);
    const labels = d.labels || {};
    sh.getRange(1, header.length + 1, 1, add.length).setNotes([add.map(k => labels[k] || '')]);
    header = header.concat(add);
  }
  const lastRow = sh.getLastRow();
  const ids = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0])) : [];
  let row = ids.indexOf(String(d.pid)) + 2;
  if (row < 2) row = lastRow + 1;
  const cur = sh.getRange(row, 1, 1, header.length).getValues()[0];
  cur[0] = d.pid; cur[1] = d.cond; cur[2] = new Date();
  keys.forEach(k => { cur[header.indexOf(k)] = d.answers[k]; });
  sh.getRange(row, 1, 1, header.length).setValues([cur]);
}

/* ---------- 행동 기록 ---------- */
function saveEvents_(d) {
  const sh = sheet_('events');
  const recv = new Date();
  const rows = (d.events || []).map(ev => {
    const rest = {};
    Object.keys(ev).forEach(k => { if (['t', 'ts', 'type', 'stage', 'screen'].indexOf(k) < 0) rest[k] = ev[k]; });
    return [recv, d.pid, d.cond, ev.t, ev.ts, ev.type, ev.stage, ev.screen, JSON.stringify(rest)];
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  const last = (d.events || []).slice(-1)[0];
  if (last) {
    const scr = /^survey_/.test(last.type) && last.page ? 'survey:' + last.page : (last.screen || '');   // 설문 중이면 설문 페이지 이름
    touch_(d.pid, { last_stage: last.stage || '', last_screen: scr });
  }
}

/* ---------- 완료: assign 갱신 + summary 한 줄 ---------- */
function complete_(d) {
  const sh = sheet_('assign');
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(String(d.pid));
  if (i >= 0) sh.getRange(i + 2, 4, 1, 3).setValues([[true, new Date(), d.code || '']]);
  else sh.appendRow([d.pid, d.cond, '', true, new Date(), d.code || '', '', '완료', '', '', '', new Date()]);
  touch_(d.pid, { last_stage: 'end', last_screen: 'end' });

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
  const sids = S.getLastRow() > 1 ? S.getRange(2, 1, S.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const j = sids.indexOf(String(d.pid));
  S.getRange(j >= 0 ? j + 2 : S.getLastRow() + 1, 1, 1, vals.length).setValues([vals]);
}

// 서버 배정에 실패한 LOCAL 참여자: 첫 기록이 들어올 때 assign에 줄을 만들어 둠 (started_at = 첫 설문 제출 시각)
function ensureLocalRow_(d) {
  if (!/^LOCAL-/.test(String(d.pid || '')) || CONDS.indexOf(d.cond) < 0) return;
  const sh = sheet_('assign');
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  if (ids.indexOf(String(d.pid)) >= 0) return;
  const at = new Date();
  sh.appendRow([d.pid, d.cond, at, false, '', '', '', '미시작', '', '', '', at]);
}

/* ---------- 진행 상태 (assign) ---------- */
const STATUS_COLOR = { '미시작': '#f1f3f4', '진행 중': '#e8f0fe', '이탈': '#fce8e6', '완료': '#e6f4ea' };
// 참여자 한 명의 마지막 위치를 갱신 (status는 refreshStatus_가 계산)
function touch_(pid, vals) {
  const sh = sheet_('assign'); const H = HEAD.assign;
  const n = sh.getLastRow() - 1; if (n < 1 || !pid) return;
  const ids = sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(pid)); if (i < 0) return;
  const row = i + 2;
  const cur = sh.getRange(row, 1, 1, H.length).getValues()[0];
  Object.keys(vals).forEach(k => { const c = H.indexOf(k); if (c >= 0 && vals[k] !== undefined) cur[c] = vals[k]; });
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
function refreshStatus() { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { refreshStatus_(); } finally { lock.releaseLock(); } }
// pages·events 탭을 처음부터 읽어 모든 참여자의 마지막 위치를 다시 채움 (예전 기록에도 상태를 붙일 때)
function rebuildStatus() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = sheet_('assign'); const H = HEAD.assign;
    const n = sh.getLastRow() - 1; if (n < 1) return;
    const rows = sh.getRange(2, 1, n, H.length).getValues();
    const info = {};
    const pg = sheet_('pages'); const pn = pg.getLastRow() - 1;
    if (pn > 0) pg.getRange(2, 1, pn, 4).getValues().forEach(([at, pid, , page]) => {
      const o = info[pid] = info[pid] || {}; o.last_page = page; o.page_at = at; if (!o.seen || at > o.seen) o.seen = at;
    });
    const ev = sheet_('events'); const en = ev.getLastRow() - 1;
    if (en > 0) ev.getRange(2, 1, en, 9).getValues().forEach(([at, pid, , t, , type, stage, screen, data]) => {
      const o = info[pid] = info[pid] || {};
      if (!o.ev_at || at >= o.ev_at) {
        o.ev_at = at; o.last_stage = stage;
        let scr = screen;
        if (/^survey_/.test(type)) { try { const pgName = JSON.parse(data || '{}').page; if (pgName) scr = 'survey:' + pgName; } catch (_) {} }
        o.last_screen = scr;
      }
      if (!o.seen || at > o.seen) o.seen = at;
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
    .addSeparator()
    .addItem('events 참여자별로 정리 (접기)', 'organizeEvents')
    .addItem('events 모두 펼치기', 'expandEvents')
    .addToUi();
}
// 참여자 번호 → 시간 순으로 정렬하고, 참여자마다 첫 줄만 보이게 나머지를 접어요.
// 수집 중에 실행해도 되지만, 그 뒤에 들어온 기록은 맨 아래에 쌓이니 필요할 때 다시 실행하세요.
function organizeEvents() {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheet_('events');
    const n = sh.getLastRow() - 1; if (n < 2) return;
    removeGroups_(sh);
    sh.getRange(2, 1, n, sh.getLastColumn()).sort([{ column: 2, ascending: true }, { column: 4, ascending: true }]);
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
  } finally { lock.releaseLock(); }
}
function expandEvents() { const sh = sheet_('events'); sh.expandAllRowGroups(); }
function removeGroups_(sh) {
  const n = sh.getMaxRows();
  try { sh.expandAllRowGroups(); } catch (_) {}
  for (let k = 0; k < 8; k++) { try { sh.getRange(1, 1, n, 1).shiftRowGroupDepth(-1); } catch (_) { break; } }
}

/* ---------- 도구 ---------- */
function logError_(err, e) {
  try {
    sheet_('errors').appendRow([new Date(), String(err), String(err && err.stack || ''), String(e && e.postData && e.postData.contents || '').slice(0, 500)]);
  } catch (_) {}
}
// 탭이 없으면 만들고, 머리글(1행)이 없거나 모자라면 채우고, 설명(메모)을 붙여요.
function sheet_(name) {
  const header = HEAD[name];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
  } else {
    const first = sh.getRange(1, 1, 1, header.length).getValues()[0].map(String);
    if (first[0] !== header[0]) { sh.insertRowBefore(1); sh.getRange(1, 1, 1, header.length).setValues([header]); }
    else if (first.join('|') !== header.join('|')) sh.getRange(1, 1, 1, header.length).setValues([header]);
    else if (sh.getRange(1, 1).getNote()) return sh;   // 머리글·설명이 이미 있으면 그대로
  }
  sh.getRange(1, 1, 1, header.length).setNotes([header.map(h => NOTE[h] || '')]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
