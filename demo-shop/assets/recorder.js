/* 사람 실험 기록 장치 (휴먼 얼라인 실험용).
 *
 * 주소에 ?record=참여자ID 를 붙여 열 때만 켜진다. 예: /?variant=problem&case=all&record=P01
 * 켜지면 같은 탭 안에서 화면을 옮겨도 계속 기록한다 (sessionStorage). 참여자마다 새 탭(또는 시크릿 창)에서 시작한다.
 * 설문을 저장하면 기록이 멈추고 저장된 탭 저장소도 비워진다.
 *
 * 기록하는 것: 화면 이동(경로·제목·시각), 클릭(눌린 요소의 글자·태그), 뒤로 가기·앞으로 가기, 폼 제출,
 *            화면에 뜬 오류 문구, 과업 성공(주문 완료 화면 도착) 또는 포기(그만두기 버튼), 끝난 뒤 설문 3문항.
 * 기록하지 않는 것: 입력칸에 쓴 글자(이름·주소·비밀번호 등), 주소·이름 등 개인정보가 보이는 영역의 글자, 마우스 위치, 다른 사이트.
 *            브라우저 정보(user_agent)는 기록하지 않는다. 화면 크기만 남긴다.
 * 서버로 보내지 않는다. 끝나면 JSON 파일로 내려받아 진행자에게 전달한다.
 */
(function () {
  const KEY = "exitplain:human-record";
  const GOAL = "/order/success";
  const SCREENS = [
    ["/", "첫 화면"],
    ["/product", "상품 상세"],
    ["/cart", "장바구니"],
    ["/signup", "회원가입"],
    ["/checkout", "배송 정보"],
    ["/order/success", "주문 완료"],
  ];
  // 이 안의 글자는 클릭 기록에서 뺀다 (개인정보가 보일 수 있는 영역). FE가 주소·이름 표시 영역에 data-xr-skip을 달면 더 안전하다.
  const PRIVATE =
    "#checkout-form, [data-xr-skip], [data-address], [data-user-name]";
  const params = new URLSearchParams(location.search);
  const now = () => Date.now();

  function load() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function save(rec) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(rec));
    } catch (e) {
      /* 저장 공간이 없으면 기록만 멈춘다 */
    }
  }

  let rec = load();
  const pid = params.get("record");
  if (
    pid &&
    /^[A-Za-z0-9_-]{1,20}$/.test(pid) &&
    (!rec || rec.participant_id !== pid)
  ) {
    rec = {
      schema: "human-record-1",
      participant_id: pid,
      variant: params.get("variant") === "problem" ? "problem" : "fixed",
      case: params.get("case") || "all",
      task: "order",
      task_name: "첫 주문 완료",
      started_at: new Date().toISOString(),
      started_ms: now(),
      viewport: [window.innerWidth, window.innerHeight],
      events: [],
      outcome: null,
      finished_at: null,
      survey: null,
    };
    save(rec);
  }
  if (!rec) return;
  // 과업이 끝났는데 설문이 아직이면 설문만 띄운다. 끝난 기록에는 아무것도 더 쌓지 않는다.
  if (rec.outcome) {
    if (!rec.survey) showSurvey();
    return;
  }

  // 끝난 뒤(rec.outcome 있음)에는 아무것도 기록하지 않는다. 설문 저장값이 덮어써지는 것도 막는다.
  function log(type, extra) {
    if (rec.outcome) return;
    rec.events.push(
      Object.assign(
        { t: now() - rec.started_ms, type: type, path: location.pathname },
        extra || {},
      ),
    );
    save(rec);
  }

  function finish(outcome) {
    if (rec.outcome) return;
    log(outcome === "success" ? "goal" : "give_up");
    rec.outcome = outcome;
    rec.finished_at = new Date().toISOString();
    rec.duration_ms = now() - rec.started_ms;
    save(rec);
    bar.remove();
    showSurvey();
  }

  function onView() {
    const last = rec.events.filter((e) => e.type === "view").pop();
    if (!last || last.path !== location.pathname)
      log("view", { title: document.title });
    if (location.pathname === GOAL) setTimeout(() => finish("success"), 300);
  }

  // 화면 순서를 history.state.xrIdx 로 센다. 그래야 뒤로 가기와 앞으로 가기를 구분할 수 있다.
  let idx = 0;
  const cur = history.state || {};
  if (typeof cur.xrIdx === "number") idx = cur.xrIdx;
  else history.replaceState(Object.assign({}, cur, { xrIdx: 0 }), "");

  const push = history.pushState;
  history.pushState = function (state, title, url) {
    idx += 1;
    const r = push.call(
      this,
      Object.assign({}, state || {}, { xrIdx: idx }),
      title,
      url,
    );
    setTimeout(onView, 0);
    return r;
  };
  const replace = history.replaceState;
  history.replaceState = function (state, title, url) {
    const r = replace.call(
      this,
      Object.assign({}, state || {}, { xrIdx: idx }),
      title,
      url,
    );
    setTimeout(onView, 0);
    return r;
  };
  window.addEventListener("popstate", (e) => {
    const to =
      e.state && typeof e.state.xrIdx === "number" ? e.state.xrIdx : null;
    const prev = rec.events.filter((ev) => ev.type === "view").pop();
    const type = to === null ? "popstate" : to < idx ? "back" : "forward";
    if (to !== null) idx = to;
    log(type, { from: prev ? prev.path : null }); // path는 이동한 화면, from은 떠난 화면
    setTimeout(onView, 0);
  });

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("#xr-bar")) return;
      const el =
        e.target.closest(
          "a,button,[data-route],[data-item],[data-add],[data-order],[data-quantity],input,select,label",
        ) || e.target;
      const tag = el.tagName.toLowerCase();
      let text = "";
      if (/^(input|select|textarea)$/.test(tag)) {
        text = el.name || el.type || ""; // 입력칸의 값은 안 남기고 칸 이름만 남긴다
      } else if (!el.closest(PRIVATE)) {
        text = (
          el.innerText ||
          el.getAttribute("aria-label") ||
          el.getAttribute("data-item") ||
          el.getAttribute("data-add") ||
          el.getAttribute("data-route") ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40);
      }
      log("click", {
        tag: tag,
        text: text,
        masked: el.closest(PRIVATE) ? true : undefined,
      });
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => log("submit", { form: e.target.id || "" }),
    true,
  );
  new MutationObserver(() => {
    const err = document.querySelector("#form-error");
    if (
      err &&
      err.textContent.trim() &&
      err.dataset.xrSeen !== err.textContent
    ) {
      err.dataset.xrSeen = err.textContent;
      log("error", { text: err.textContent.trim().slice(0, 60) });
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const bar = document.createElement("div");
  bar.id = "xr-bar";
  bar.setAttribute(
    "style",
    "position:fixed;left:12px;bottom:12px;z-index:9999;background:#222;color:#fff;padding:8px 12px;" +
      "border-radius:10px;font:13px/1.4 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)",
  );
  bar.innerHTML =
    "실험 중 · " +
    rec.participant_id +
    ' <button type="button" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:0;cursor:pointer">그만두기</button>';
  bar.querySelector("button").addEventListener("click", () => {
    if (
      confirm(
        "여기서 그만두시겠어요? (괜찮아요, 그만두는 것도 중요한 결과예요)",
      )
    )
      finish("give_up");
  });
  const mount = () => {
    document.body.appendChild(bar);
    onView();
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  function showSurvey() {
    const r = rec; // 같은 객체에 쓴다 (다시 읽어 덮어쓰지 않는다)
    const box = document.createElement("div");
    box.setAttribute(
      "style",
      "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;" +
        "justify-content:center;font:15px/1.5 sans-serif",
    );
    const options =
      SCREENS.map(
        ([p, n]) =>
          `<label style="display:block;margin:4px 0"><input type="radio" name="xr-screen" value="${p}"> ${n}</label>`,
      ).join("") +
      '<label style="display:block;margin:4px 0"><input type="radio" name="xr-screen" value="none"> 특별히 없었어요</label>';
    const scale = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<label style="margin-right:10px"><input type="radio" name="xr-pain" value="${n}"> ${n}</label>`,
      )
      .join("");
    box.innerHTML = `<div style="background:#fff;color:#111;max-width:420px;width:92%;padding:20px;border-radius:14px">
      <h2 style="margin:0 0 6px;font-size:18px">${r.outcome === "success" ? "주문을 마쳤어요" : "여기까지 해 주셔서 감사해요"}</h2>
      <p style="margin:0 0 12px;color:#555">마지막으로 세 가지만 알려 주세요.</p>
      <p style="margin:8px 0 4px;font-weight:600">1. 가장 헷갈리거나 불편했던 화면은?</p>${options}
      <p style="margin:12px 0 4px;font-weight:600">2. 전체적으로 얼마나 불편했나요? (1 전혀 아님 ~ 5 매우 불편)</p>${scale}
      <p style="margin:12px 0 4px;font-weight:600">3. 불편했던 점이 있다면 (선택, 이름·연락처는 적지 마세요)</p>
      <textarea id="xr-note" rows="2" maxlength="200" style="width:100%;box-sizing:border-box"></textarea>
      <p style="margin:10px 0 0;color:#555;font-size:13px">화면 이동과 클릭 기록(입력한 내용은 제외), 화면 크기가 파일에 담겨요. 연구 목적으로만 쓰고 외부에 공개하지 않아요.</p>
      <button type="button" id="xr-save" style="margin-top:14px;width:100%;padding:10px;border:0;border-radius:8px;background:#5b4bdb;color:#fff;font-size:15px;cursor:pointer">결과 저장하기</button>
      <p id="xr-msg" style="margin:8px 0 0;color:#c00;font-size:13px"></p></div>`;
    document.body.appendChild(box);
    const btn = box.querySelector("#xr-save");
    btn.addEventListener("click", () => {
      const screen = box.querySelector("input[name=xr-screen]:checked");
      const pain = box.querySelector("input[name=xr-pain]:checked");
      if (!screen || !pain) {
        box.querySelector("#xr-msg").textContent = "1번과 2번을 골라 주세요.";
        return;
      }
      btn.disabled = true; // 두 번 눌러도 같은 값으로 한 번만 저장
      r.survey = {
        confusing_screen: screen.value,
        discomfort: Number(pain.value),
        note: box.querySelector("#xr-note").value.trim().slice(0, 200),
      };
      save(r);
      const blob = new Blob([JSON.stringify(r, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `human_${r.participant_id}_${r.variant}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      try {
        sessionStorage.removeItem(KEY);
      } catch (e) {
        /* 무시 */
      } // 저장 후에는 이 탭의 기록을 멈춘다
      box.querySelector("#xr-msg").style.color = "#2a7";
      box.querySelector("#xr-msg").textContent =
        `저장했어요 (human_${r.participant_id}_${r.variant}.json). 진행자에게 파일을 보내 주세요.`;
    });
  }
})();
