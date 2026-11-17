/* 사람 실험 기록 장치 (휴먼 얼라인 실험용).
 *
 * 주소에 ?record=참여자ID 를 붙여 열 때만 켜진다. 예: /?variant=problem&case=all&record=P01
 * 켜지면 같은 탭 안에서 화면을 옮겨도 계속 기록한다 (sessionStorage).
 *
 * 기록하는 것: 화면 이동(경로·시각), 클릭(눌린 요소의 글자·태그), 뒤로 가기, 폼 제출, 화면에 뜬 오류 문구,
 *            과업 성공(주문 완료 화면 도착) 또는 포기(그만두기 버튼), 끝난 뒤 설문 2문항.
 * 기록하지 않는 것: 입력칸에 쓴 글자(이름·주소·비밀번호 등), 마우스 위치, 다른 사이트.
 * 서버로 보내지 않는다. 끝나면 JSON 파일로 내려받아 진행자에게 전달한다.
 */
(function () {
  const KEY = 'exitplain:human-record';
  const GOAL = '/order/success';
  const SCREENS = [
    ['/', '첫 화면'], ['/product', '상품 상세'], ['/cart', '장바구니'], ['/signup', '회원가입'],
    ['/checkout', '배송 정보'], ['/order/success', '주문 완료'],
  ];
  const params = new URLSearchParams(location.search);
  const now = () => Date.now();

  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(rec) {
    try { sessionStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* 저장 공간이 없으면 기록만 멈춘다 */ }
  }

  let rec = load();
  const pid = params.get('record');
  if (pid && /^[A-Za-z0-9_-]{1,20}$/.test(pid) && (!rec || rec.participant_id !== pid)) {
    rec = {
      schema: 'human-record-1', participant_id: pid,
      variant: params.get('variant') === 'problem' ? 'problem' : 'fixed', case: params.get('case') || 'all',
      task: 'order', task_name: '첫 주문 완료', started_at: new Date().toISOString(), started_ms: now(),
      user_agent: navigator.userAgent, viewport: [window.innerWidth, window.innerHeight],
      events: [], outcome: null, finished_at: null, survey: null,
    };
    save(rec);
  }
  if (!rec || rec.outcome) { if (rec && rec.outcome && !rec.survey) showSurvey(); return; }

  function log(type, extra) {
    rec.events.push(Object.assign({ t: now() - rec.started_ms, type: type, path: location.pathname }, extra || {}));
    save(rec);
  }

  function finish(outcome) {
    if (rec.outcome) return;
    log(outcome === 'success' ? 'goal' : 'give_up');
    rec.outcome = outcome;
    rec.finished_at = new Date().toISOString();
    rec.duration_ms = now() - rec.started_ms;
    save(rec);
    bar.remove();
    showSurvey();
  }

  function onView() {
    const last = rec.events.filter(e => e.type === 'view').pop();
    if (!last || last.path !== location.pathname) log('view', { title: document.title });
    if (location.pathname === GOAL) setTimeout(() => finish('success'), 300);
  }

  const push = history.pushState;
  history.pushState = function () { const r = push.apply(this, arguments); setTimeout(onView, 0); return r; };
  window.addEventListener('popstate', () => {
    const prev = rec.events.filter(e => e.type === 'view').pop();
    log('back', { from: prev ? prev.path : null });          // path는 돌아간 화면, from은 떠난 화면
    setTimeout(onView, 0);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('#xr-bar')) return;
    const el = e.target.closest('a,button,[data-route],[data-item],[data-add],[data-order],[data-quantity],input,select,label') || e.target;
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const isInput = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    log('click', { tag: el.tagName.toLowerCase(), text: isInput ? (el.name || el.type || '') : text });
  }, true);
  document.addEventListener('submit', e => log('submit', { form: e.target.id || '' }), true);
  new MutationObserver(() => {
    const err = document.querySelector('#form-error');
    if (err && err.textContent.trim() && err.dataset.xrSeen !== err.textContent) {
      err.dataset.xrSeen = err.textContent;
      log('error', { text: err.textContent.trim().slice(0, 60) });
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  const bar = document.createElement('div');
  bar.id = 'xr-bar';
  bar.setAttribute('style', 'position:fixed;left:12px;bottom:12px;z-index:9999;background:#222;color:#fff;padding:8px 12px;' +
    'border-radius:10px;font:13px/1.4 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)');
  bar.innerHTML = '실험 중 · ' + rec.participant_id +
    ' <button type="button" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:0;cursor:pointer">그만두기</button>';
  bar.querySelector('button').addEventListener('click', () => {
    if (confirm('여기서 그만두시겠어요? (괜찮아요, 그만두는 것도 중요한 결과예요)')) finish('give_up');
  });
  const mount = () => { document.body.appendChild(bar); onView(); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function showSurvey() {
    const r = load() || rec;
    const box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;' +
      'justify-content:center;font:15px/1.5 sans-serif');
    const options = SCREENS.map(([p, n]) => `<label style="display:block;margin:4px 0"><input type="radio" name="xr-screen" value="${p}"> ${n}</label>`).join('') +
      '<label style="display:block;margin:4px 0"><input type="radio" name="xr-screen" value="none"> 특별히 없었어요</label>';
    const scale = [1, 2, 3, 4, 5].map(n => `<label style="margin-right:10px"><input type="radio" name="xr-pain" value="${n}"> ${n}</label>`).join('');
    box.innerHTML = `<div style="background:#fff;color:#111;max-width:420px;width:92%;padding:20px;border-radius:14px">
      <h2 style="margin:0 0 6px;font-size:18px">${r.outcome === 'success' ? '주문을 마쳤어요' : '여기까지 해 주셔서 감사해요'}</h2>
      <p style="margin:0 0 12px;color:#555">마지막으로 두 가지만 알려 주세요.</p>
      <p style="margin:8px 0 4px;font-weight:600">1. 가장 헷갈리거나 불편했던 화면은?</p>${options}
      <p style="margin:12px 0 4px;font-weight:600">2. 전체적으로 얼마나 불편했나요? (1 전혀 아님 ~ 5 매우 불편)</p>${scale}
      <p style="margin:12px 0 4px;font-weight:600">3. 불편했던 점이 있다면 (선택)</p>
      <textarea id="xr-note" rows="2" maxlength="200" style="width:100%;box-sizing:border-box"></textarea>
      <button type="button" id="xr-save" style="margin-top:14px;width:100%;padding:10px;border:0;border-radius:8px;background:#5b4bdb;color:#fff;font-size:15px;cursor:pointer">결과 저장하기</button>
      <p id="xr-msg" style="margin:8px 0 0;color:#c00;font-size:13px"></p></div>`;
    document.body.appendChild(box);
    box.querySelector('#xr-save').addEventListener('click', () => {
      const screen = box.querySelector('input[name=xr-screen]:checked');
      const pain = box.querySelector('input[name=xr-pain]:checked');
      if (!screen || !pain) { box.querySelector('#xr-msg').textContent = '1번과 2번을 골라 주세요.'; return; }
      r.survey = { confusing_screen: screen.value, discomfort: Number(pain.value),
                   note: box.querySelector('#xr-note').value.trim().slice(0, 200) };
      save(r);
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `human_${r.participant_id}_${r.variant}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      box.querySelector('#xr-msg').style.color = '#2a7';
      box.querySelector('#xr-msg').textContent = `저장했어요 (human_${r.participant_id}_${r.variant}.json). 진행자에게 파일을 보내 주세요.`;
    });
  }
})();
