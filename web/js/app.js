/* Состояние приложения и роутинг между режимами.
   App state and routing between views. UI text comes from SAA_I18N (js/i18n.js);
   setLocale() triggers applyStaticText() + a full re-render of whatever is on screen. */
(function (global) {
  "use strict";

  var Q = global.SAA_Quiz;
  var S = global.SAA_Storage;
  var T = global.SAA_Theory;
  var I = global.SAA_I18N;
  var el = Q.el;
  var t = I.t;

  var $ = function (id) { return document.getElementById(id); };

  var VIEWS = ["practice", "exam", "theory", "progress"];
  var NARROW = "(max-width: 820px)";
  function isNarrow() { return window.matchMedia(NARROW).matches; }

  var view = "practice";
  var practice = null;
  var exam = null;
  var theoryView = null;
  var chapterIds = null;      /* активный фильтр «вопросы главы» */
  var chapterTitleKey = null; /* {chapterId} или {key,args} — не готовая строка, а как её получить
                                  заново на текущем языке (см. resolveChapterFilterTitle) */

  /* ---------------- статический текст интерфейса ---------------- */

  var TAB_KEYS = { practice: "tabPractice", exam: "tabExam", theory: "tabTheory", progress: "tabProgress" };

  function applyStaticText() {
    document.getElementById("meta-description").setAttribute("content", t("metaDescription"));

    document.querySelectorAll(".tab").forEach(function (btn) {
      btn.textContent = t(TAB_KEYS[btn.dataset.view]);
    });

    $("f-toggle").textContent = $("practice-filters").classList.contains("open")
      ? t("filtersToggleOpen") : t("filtersToggleClosed");
    $("lbl-dom").textContent = t("filterDomain");
    $("opt-dom-all").textContent = t("filterAll");
    $("lbl-svc").textContent = t("filterService");
    $("opt-svc-all").textContent = t("filterAll");
    $("lbl-status").textContent = t("filterStatus");
    $("opt-status-all").textContent = t("statusAll");
    $("opt-status-unseen").textContent = t("statusUnseen");
    $("opt-status-wrong").textContent = t("statusWrong");
    $("opt-status-correct").textContent = t("statusCorrect");
    $("opt-status-flagged").textContent = t("statusFlagged");
    $("opt-status-corrected").textContent = t("statusCorrected");
    $("opt-status-disputed").textContent = t("statusDisputed");
    $("opt-status-manual").textContent = t("statusManual");
    $("lbl-order").textContent = t("filterOrder");
    $("opt-order-id").textContent = t("orderId");
    $("opt-order-random").textContent = t("orderRandom");
    $("lbl-search").textContent = t("filterSearch");
    $("f-find").setAttribute("placeholder", t("searchPlaceholder"));
    $("f-apply").textContent = t("applyBtn");
    $("practice-empty").textContent = t("practiceEmpty");

    $("exam-title").textContent = t("examTitle");
    $("exam-intro").textContent = t("examIntro");
    $("lbl-exam-exclude").textContent = t("examExcludeSeen");
    $("exam-begin").textContent = t("examBegin");
    $("exam-warn").textContent = t("examUnfinished");
    $("exam-continue").textContent = t("examContinue");
    $("exam-drop").textContent = t("examDrop");
    $("exam-finish").textContent = t("examFinish");

    $("theory-search").setAttribute("placeholder", t("theorySearchPlaceholder"));
    var initialEmpty = $("theory-initial-empty");
    if (initialEmpty) initialEmpty.textContent = t("theoryChooseChapter");

    document.querySelectorAll("#lang-toggle button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === I.getLocale());
    });

    if (chapterIds) renderChapterFilterBox();
  }

  /* ---------------- навигация ---------------- */

  function show(name, fromHistory) {
    view = name;
    VIEWS.forEach(function (v) {
      $("view-" + v).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.view === name);
    });
    if (name === "progress") renderProgress();
    if (name === "theory") theoryView.renderList();
    if (name !== "exam" && exam) exam.stop();
    if (name === "exam" && exam && exam.state) exam.run();
    if (!fromHistory) location.hash = name;
  }

  /* кнопка «назад» в браузере и в приложении переключает вкладки, а не выходит молча */
  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace("#", "");
    if (VIEWS.indexOf(h) !== -1 && h !== view) show(h, true);
  });

  /* ---------------- тренировка ---------------- */

  function fillFilters() {
    var domSel = $("f-dom");
    domSel.querySelectorAll("option:not(#opt-dom-all)").forEach(function (o) { o.remove(); });
    Q.meta.domains.forEach(function (d) {
      var o = el("option", "", d.code + " — " + d.name);
      o.value = d.code;
      domSel.appendChild(o);
    });
    var counts = {};
    Q.bank.forEach(function (q) {
      (q.svc || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    });
    var svcSel = $("f-svc");
    svcSel.querySelectorAll("option:not(#opt-svc-all)").forEach(function (o) { o.remove(); });
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (s) {
      var o = el("option", "", s + " (" + counts[s] + ")");
      o.value = s;
      svcSel.appendChild(o);
    });
  }

  /* на телефоне фильтры занимают весь экран, поэтому по умолчанию они свёрнуты */
  function setFiltersOpen(open) {
    $("practice-filters").classList.toggle("open", open);
    $("f-toggle").setAttribute("aria-expanded", open ? "true" : "false");
    $("f-toggle").textContent = open ? t("filtersToggleOpen") : t("filtersToggleClosed");
  }

  function filtersSummary(count) {
    var parts = [];
    if ($("f-dom").value) parts.push($("f-dom").value);
    if ($("f-svc").value) parts.push($("f-svc").value);
    var status = $("f-status");
    if (status.value !== "all") parts.push(status.options[status.selectedIndex].textContent);
    var find = ($("f-find").value || "").trim();
    if (find) parts.push(t("quoted", find));
    return t("questionsCount", count) + (parts.length ? " · " + parts.join(" · ") : "");
  }

  function applyFilters() {
    var find = ($("f-find").value || "").trim();
    var byNumber = /^#?\d+$/.test(find) ? parseInt(find.replace("#", ""), 10) : null;
    var list = Q.filter({
      ids: chapterIds,
      dom: $("f-dom").value || null,
      svc: $("f-svc").value || null,
      status: $("f-status").value,
      order: $("f-order").value,
      text: byNumber ? null : (find.length >= 2 ? find.toLowerCase() : null)
    });
    $("practice-empty").classList.toggle("hidden", list.length > 0);
    $("practice-card").classList.toggle("hidden", list.length === 0);
    $("f-summary").textContent = filtersSummary(list.length);
    practice.setList(list);
    if (byNumber && !practice.jumpToId(byNumber)) openQuestion(byNumber);
  }

  /* переход к конкретному вопросу: если под текущие фильтры он не подходит, снимаем их */
  function openQuestion(id) {
    if (!Q.byId[id]) return false;
    setChapterFilter(null);
    $("f-dom").value = ""; $("f-svc").value = ""; $("f-status").value = "all"; $("f-order").value = "id";
    practice.setList(Q.filter({ status: "all", order: "id" }));
    practice.jumpToId(id);
    $("f-summary").textContent = filtersSummary(Q.bank.length);
    if (isNarrow()) setFiltersOpen(false);
    show("practice");
    return true;
  }

  /* chapterTitleKey holds a {chapterId} or {key,args} descriptor rather than a resolved
     string, so the pill can re-translate on a language switch instead of keeping whatever
     text was current when the filter was set (chapter titles and UI strings alike). */
  function resolveChapterFilterTitle(desc) {
    if (!desc) return "";
    if (desc.chapterId != null) {
      var c = T.byId(desc.chapterId);
      return c ? c.title : "";
    }
    if (desc.key) return t.apply(null, [desc.key].concat(desc.args || []));
    return "";
  }

  function renderChapterFilterBox() {
    var box = $("chapter-filter");
    box.innerHTML = "";
    if (!chapterIds) { box.classList.add("hidden"); return; }
    box.appendChild(document.createTextNode(t("chapterFilterLabel", resolveChapterFilterTitle(chapterTitleKey), chapterIds.length)));
    var x = el("button", "", "✕");
    x.title = t("clearChapterFilterTitle");
    x.addEventListener("click", function () { setChapterFilter(null); applyFilters(); });
    box.appendChild(x);
    box.classList.remove("hidden");
  }

  function setChapterFilter(ids, titleDesc) {
    chapterIds = ids && ids.length ? ids : null;
    chapterTitleKey = titleDesc || null;
    renderChapterFilterBox();
    if (chapterIds && isNarrow()) setFiltersOpen(false);
  }

  /* ---------------- экзамен ---------------- */

  function renderExamPlan() {
    var plan = $("exam-plan");
    plan.innerHTML = "";
    Q.meta.domains.forEach(function (d) {
      plan.appendChild(el("span", "chip dom-" + d.code, t("examPlanChip", d.code, d.exam, Math.round(d.weight * 100))));
    });
    $("exam-resume").classList.toggle("hidden", !S.currentExam());
  }

  function examScreen(which) {
    $("exam-start").classList.toggle("hidden", which !== "start");
    $("exam-run").classList.toggle("hidden", which !== "run");
    $("exam-result").classList.toggle("hidden", which !== "result");
    if (which === "start") renderExamPlan();
  }

  var lastExamResult = null;

  function renderExamResult(r) {
    lastExamResult = r;
    var box = $("exam-result");
    box.innerHTML = "";
    var panel = el("div", "panel");
    var pass = r.score >= 72;
    panel.appendChild(el("h2", "", t("resultTitle")));
    panel.appendChild(el("div", "score " + (pass ? "pass" : "fail"), r.score + "%"));
    panel.appendChild(el("div", "cap", t("resultCap", r.right, r.total,
      Math.floor(r.spent / 60), r.spent % 60)));

    var bars = el("div", "bars");
    Q.meta.domains.forEach(function (d) {
      var s = r.byDom[d.code] || { total: 0, right: 0 };
      var pct = s.total ? Math.round(100 * s.right / s.total) : 0;
      var row = el("div", "bar-row");
      row.appendChild(el("span", "", d.code + " " + d.name.replace("Design ", "")));
      var bar = el("div", "bar");
      var fill = el("i", pct >= 72 ? "ok" : "bad");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", "", s.right + "/" + s.total));
      bars.appendChild(row);
    });
    panel.appendChild(bars);

    var again = el("button", "btn primary", t("resultNewExam"));
    again.addEventListener("click", function () { examScreen("start"); });
    panel.appendChild(again);

    var wrongIds = r.details.filter(function (d) { return !d.ok; }).map(function (d) { return d.id; });
    if (wrongIds.length) {
      var toWrong = el("button", "btn", t("resultReviewMistakes", wrongIds.length));
      toWrong.style.marginLeft = "10px";
      toWrong.addEventListener("click", function () {
        setChapterFilter(wrongIds, { key: "resultMistakesTitle" });
        $("f-dom").value = ""; $("f-svc").value = ""; $("f-status").value = "all"; $("f-order").value = "id";
        applyFilters();
        show("practice");
      });
      panel.appendChild(toWrong);
    }
    box.appendChild(panel);

    var list = el("div", "panel");
    list.style.marginTop = "16px";
    list.appendChild(el("h3", "", t("resultAllReview")));
    r.details.forEach(function (d) {
      var q = Q.byId[d.id];
      var card = Q.buildCard(q, {
        mode: "review",
        picked: d.picked.split(""),
        revealed: true,
        position: ""
      }, {
        onPick: function () {},
        onTheory: function (id) { show("theory"); theoryView.open(id); },
        onFlag: function () {},
        onQuestions: function (ids, title) {
          setChapterFilter(ids, title);
          $("f-dom").value = ""; $("f-svc").value = ""; $("f-status").value = "all"; $("f-find").value = "";
          applyFilters();
          show("practice");
        }
      });
      card.style.marginTop = "12px";
      list.appendChild(card);
    });
    box.appendChild(list);
    examScreen("result");
  }

  /* ---------------- прогресс ---------------- */

  function renderProgress() {
    var body = $("progress-body");
    body.innerHTML = "";
    var st = S.stats(Q.bank);

    var cards = el("div", "cards");
    function card(big, cap, cls) {
      var c = el("div", "card");
      var b = el("div", "big " + (cls || ""), big);
      c.appendChild(b);
      c.appendChild(el("div", "cap", cap));
      return c;
    }
    cards.appendChild(card(st.seen + " / " + st.total, t("progressDone")));
    cards.appendChild(card(st.seen ? Math.round(100 * st.right / st.seen) + "%" : "—", t("progressAccuracy")));
    cards.appendChild(card(String(st.wrong), t("progressWrong")));
    cards.appendChild(card(String(st.flagged), t("progressFlagged")));
    cards.appendChild(card(String(S.exams().length), t("progressAttempts")));
    body.appendChild(cards);

    var doms = el("div", "panel");
    doms.appendChild(el("h3", "", t("progressByDomain")));
    var bars = el("div", "bars");
    Q.meta.domains.forEach(function (d) {
      var s = st.byDom[d.code] || { total: 0, seen: 0, right: 0 };
      var pct = s.seen ? Math.round(100 * s.right / s.seen) : 0;
      var row = el("div", "bar-row");
      row.appendChild(el("span", "", d.code + " " + d.name.replace("Design ", "")));
      var bar = el("div", "bar");
      var fill = el("i", s.seen ? (pct >= 72 ? "ok" : "bad") : "");
      fill.style.width = (s.seen ? pct : 0) + "%";
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(el("span", "", s.seen ? pct + "% (" + s.seen + "/" + s.total + ")" : "0/" + s.total));
      bars.appendChild(row);
    });
    doms.appendChild(bars);
    body.appendChild(doms);

    var weak = el("div", "panel");
    weak.style.marginTop = "16px";
    weak.appendChild(el("h3", "", t("progressWeakTopics")));
    var svcStats = S.statsBySvc(Q.bank).filter(function (x) { return x.seen >= 5; });
    svcStats.sort(function (a, b) { return (a.right / a.seen) - (b.right / b.seen); });
    if (!svcStats.length) {
      weak.appendChild(el("div", "empty", t("progressWeakEmpty")));
    } else {
      weak.appendChild(el("div", "cap", t("progressWeakCap")));
      var t1 = el("table", "history weak-svc");
      t1.innerHTML = "<thead><tr><th>" + t("thService") + "</th><th>" + t("thAccuracy") +
        "</th><th>" + t("thCorrect") + "</th><th>" + t("thAnswered") + "</th><th>" + t("thInBank") + "</th></tr></thead>";
      var tb = el("tbody");
      svcStats.slice(0, 15).forEach(function (x) {
        var pct = Math.round(100 * x.right / x.seen);
        var tr = el("tr");
        tr.className = pct >= 72 ? "" : "low";
        [x.svc, pct + "%", String(x.right), String(x.seen), String(x.total)].forEach(function (c) {
          tr.appendChild(el("td", "", c));
        });
        tr.addEventListener("click", function () {
          setChapterFilter(null);
          $("f-dom").value = ""; $("f-status").value = "all"; $("f-find").value = "";
          $("f-svc").value = x.svc;
          applyFilters();
          show("practice");
        });
        tb.appendChild(tr);
      });
      t1.appendChild(tb);
      var weakWrap = el("div", "table-wrap");
      weakWrap.appendChild(t1);
      weak.appendChild(weakWrap);
    }
    body.appendChild(weak);

    var hist = el("div", "panel");
    hist.style.marginTop = "16px";
    hist.appendChild(el("h3", "", t("progressExamHistory")));
    var exams = S.exams();
    if (!exams.length) {
      hist.appendChild(el("div", "empty", t("progressNoAttempts")));
    } else {
      hist.appendChild(el("div", "cap", t("progressHistoryCap")));
      var t2 = el("table", "history");
      t2.innerHTML = "<thead><tr><th>" + t("thDate") + "</th><th>" + t("thResult") + "</th><th>" +
        t("thCorrect") + "</th><th>" + t("thTime") + "</th>" +
        "<th>SEC</th><th>RES</th><th>PERF</th><th>COST</th></tr></thead>";
      var tb2 = el("tbody");
      exams.forEach(function (r) {
        var tr = el("tr", "replay");
        tr.title = t("replayTitle");
        tr.addEventListener("click", function () { show("exam"); renderExamResult(r); });
        var cells = [
          new Date(r.ts).toLocaleString(I.getLocale() === "en" ? "en-US" : "ru-RU"),
          r.score + "%",
          r.right + "/" + r.total,
          t("minutesShort", Math.floor(r.spent / 60))
        ];
        ["SEC", "RES", "PERF", "COST"].forEach(function (d) {
          var s = r.byDom[d] || { total: 0, right: 0 };
          cells.push(s.right + "/" + s.total);
        });
        cells.forEach(function (c) { tr.appendChild(el("td", "", c)); });
        tb2.appendChild(tr);
      });
      t2.appendChild(tb2);
      var histWrap = el("div", "table-wrap");
      histWrap.appendChild(t2);
      hist.appendChild(histWrap);
    }
    body.appendChild(hist);

    var tools = el("div", "panel");
    tools.style.marginTop = "16px";
    tools.appendChild(el("h3", "", t("progressData")));
    var exportBtn = el("button", "btn", t("exportBtn"));
    exportBtn.addEventListener("click", function () {
      var text = S.export();
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      else window.prompt(t("exportPrompt"), text);
      exportBtn.textContent = t("exportCopied");
      setTimeout(function () { exportBtn.textContent = t("exportBtn"); }, 1500);
    });
    var importBtn = el("button", "btn", t("importBtn"));
    importBtn.style.marginLeft = "10px";
    importBtn.addEventListener("click", function () {
      var text = window.prompt(t("importPrompt"));
      if (!text) return;
      try { S.import(text); renderProgress(); } catch (e) { alert(t("importError", e.message)); }
    });
    var resetBtn = el("button", "btn ghost", t("resetBtn"));
    resetBtn.style.marginLeft = "10px";
    resetBtn.addEventListener("click", function () {
      if (!confirm(t("resetConfirm"))) return;
      S.reset();
      renderProgress();
      applyFilters();
    });
    tools.appendChild(exportBtn);
    tools.appendChild(importBtn);
    tools.appendChild(resetBtn);
    body.appendChild(tools);
  }

  /* ---------------- смена языка: перерисовать всё, что сейчас видно ---------------- */

  function rerenderCurrentView() {
    $("bank-info").textContent = t("bankInfo", Q.bank.length, Q.meta.audited, T.chapters.length);
    applyStaticText();
    fillFilters();
    $("f-summary").textContent = filtersSummary(practice ? practice.list.length : 0);
    if (practice) practice.render();
    renderExamPlan();
    if (exam && exam.state && !$("exam-run").classList.contains("hidden")) exam.render();
    if (!$("exam-result").classList.contains("hidden") && lastExamResult) renderExamResult(lastExamResult);
    theoryView.renderList();
    if (theoryView.activeId) theoryView.open(theoryView.activeId);
    if (view === "progress") renderProgress();
  }

  /* ---------------- запуск ---------------- */

  function init() {
    document.documentElement.lang = I.getLocale();

    $("bank-info").textContent = t("bankInfo", Q.bank.length, Q.meta.audited, T.chapters.length);

    applyStaticText();
    fillFilters();

    practice = new Q.Practice($("practice-card"), {
      onTheory: function (id) { show("theory"); theoryView.open(id); },
      onQuestions: function (ids, title) {
        setChapterFilter(ids, title);
        $("f-status").value = "all";
        $("f-find").value = "";
        applyFilters();
        show("practice");
      },
      onFlag: function () {}
    });

    theoryView = new T.View({ list: $("theory-index"), body: $("theory-body"), search: $("theory-search") }, {
      onPractice: function (c) {
        setChapterFilter(c.questions, { chapterId: c.id });
        $("f-dom").value = ""; $("f-svc").value = ""; $("f-status").value = "all";
        applyFilters();
        show("practice");
      },
      onQuestions: function (ids, title) {
        setChapterFilter(ids, title);
        $("f-status").value = "all";
        applyFilters();
        show("practice");
      }
    });
    theoryView.renderList();

    exam = new Q.Exam({
      card: $("exam-card"), grid: $("exam-grid"),
      counter: $("exam-counter"), timer: $("exam-timer")
    }, {
      onFinish: renderExamResult
    });

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { show(t.dataset.view); });
    });
    $("f-toggle").addEventListener("click", function () {
      setFiltersOpen(!$("practice-filters").classList.contains("open"));
    });
    $("f-apply").addEventListener("click", function () {
      applyFilters();
      if (isNarrow()) setFiltersOpen(false);
    });
    ["f-dom", "f-svc", "f-status", "f-order"].forEach(function (id) {
      $(id).addEventListener("change", applyFilters);
    });
    $("f-find").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        applyFilters();
        if (isNarrow()) { e.target.blur(); setFiltersOpen(false); }
      }
    });
    $("f-find").addEventListener("search", applyFilters);

    $("exam-begin").addEventListener("click", function () {
      exam.start($("exam-exclude-seen").checked);
      examScreen("run");
    });
    $("exam-continue").addEventListener("click", function () {
      if (exam.resume()) examScreen("run");
    });
    $("exam-drop").addEventListener("click", function () {
      S.clearCurrentExam();
      renderExamPlan();
    });
    $("exam-finish").addEventListener("click", function () {
      if (!exam.state) return;
      var unanswered = exam.state.ids.filter(function (id) {
        return !(exam.state.answers[id] || []).length;
      }).length;
      if (unanswered && !confirm(t("examFinishConfirm", unanswered))) return;
      exam.finish();
    });

    document.querySelectorAll("#lang-toggle button").forEach(function (b) {
      b.addEventListener("click", function () { I.setLocale(b.dataset.lang); });
    });
    I.onChange(function () { rerenderCurrentView(); });

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (view === "practice") practice.key(e);
      else if (view === "exam" && exam.state && !$("exam-run").classList.contains("hidden")) exam.key(e);
    });

    setFiltersOpen(!isNarrow());
    window.matchMedia(NARROW).addEventListener("change", function (e) { setFiltersOpen(!e.matches); });
    applyFilters();
    examScreen("start");
    var start = (location.hash || "").replace("#", "");
    show(VIEWS.indexOf(start) !== -1 ? start : "practice");
  }

  /* Офлайн-режим на сайте: кеш приложения и данных.
     Локально (file:// и http://localhost) не регистрируем — иначе правки прячутся за кешем. */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (window.Capacitor) return;            /* в приложении офлайн обеспечивает сам APK */
    if (location.protocol !== "https:") return;
    navigator.serviceWorker.register("sw.js").catch(function (e) {
      console.warn("service worker не зарегистрирован:", e);
    });
  }

  /* Мостик для нативной оболочки: один шаг «назад» по состоянию интерфейса.
     Возвращает false, когда отступать некуда — тогда приложение можно закрывать. */
  global.SAA_App = {
    view: function () { return view; },
    show: show,
    back: function () {
      var layout = document.querySelector(".theory-layout");
      if (view === "theory" && layout && layout.classList.contains("reading")) {
        theoryView.showList();
        return true;
      }
      if (view === "practice" && $("practice-filters").classList.contains("open") && isNarrow()) {
        setFiltersOpen(false);
        return true;
      }
      if (view === "practice" && chapterIds) {
        setChapterFilter(null);
        applyFilters();
        return true;
      }
      if (view !== "practice") {
        show("practice");
        return true;
      }
      return false;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  registerServiceWorker();
})(window);
