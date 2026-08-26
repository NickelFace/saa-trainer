/* Состояние приложения и роутинг между режимами. */
(function (global) {
  "use strict";

  var Q = global.SAA_Quiz;
  var S = global.SAA_Storage;
  var T = global.SAA_Theory;
  var el = Q.el;

  var $ = function (id) { return document.getElementById(id); };

  var VIEWS = ["practice", "exam", "theory", "progress"];
  var NARROW = "(max-width: 820px)";
  function isNarrow() { return window.matchMedia(NARROW).matches; }

  var view = "practice";
  var practice = null;
  var exam = null;
  var theoryView = null;
  var chapterIds = null;      /* активный фильтр «вопросы главы» */

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
    $("f-toggle").textContent = open ? "Фильтры ▴" : "Фильтры ▾";
  }

  function filtersSummary(count) {
    var parts = [];
    if ($("f-dom").value) parts.push($("f-dom").value);
    if ($("f-svc").value) parts.push($("f-svc").value);
    var status = $("f-status");
    if (status.value !== "all") parts.push(status.options[status.selectedIndex].textContent);
    var find = ($("f-find").value || "").trim();
    if (find) parts.push("«" + find + "»");
    return count + " вопр." + (parts.length ? " · " + parts.join(" · ") : "");
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

  function setChapterFilter(ids, title) {
    chapterIds = ids && ids.length ? ids : null;
    var box = $("chapter-filter");
    box.innerHTML = "";
    if (chapterIds) {
      box.appendChild(document.createTextNode("глава: " + title + " (" + chapterIds.length + ") "));
      var x = el("button", "", "✕");
      x.title = "снять фильтр главы";
      x.addEventListener("click", function () { setChapterFilter(null); applyFilters(); });
      box.appendChild(x);
      box.classList.remove("hidden");
      if (isNarrow()) setFiltersOpen(false);
    } else {
      box.classList.add("hidden");
    }
  }

  /* ---------------- экзамен ---------------- */

  function renderExamPlan() {
    var plan = $("exam-plan");
    plan.innerHTML = "";
    Q.meta.domains.forEach(function (d) {
      plan.appendChild(el("span", "chip dom-" + d.code, d.code + " — " + d.exam + " вопр. (" +
        Math.round(d.weight * 100) + "%)"));
    });
    $("exam-resume").classList.toggle("hidden", !S.currentExam());
  }

  function examScreen(which) {
    $("exam-start").classList.toggle("hidden", which !== "start");
    $("exam-run").classList.toggle("hidden", which !== "run");
    $("exam-result").classList.toggle("hidden", which !== "result");
    if (which === "start") renderExamPlan();
  }

  function renderExamResult(r) {
    var box = $("exam-result");
    box.innerHTML = "";
    var panel = el("div", "panel");
    var pass = r.score >= 72;
    panel.appendChild(el("h2", "", "Результат"));
    panel.appendChild(el("div", "score " + (pass ? "pass" : "fail"), r.score + "%"));
    panel.appendChild(el("div", "cap", r.right + " из " + r.total + " · время " +
      Math.floor(r.spent / 60) + " мин " + (r.spent % 60) + " с · порог сдачи примерно 72%"));

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

    var again = el("button", "btn primary", "Новый экзамен");
    again.addEventListener("click", function () { examScreen("start"); });
    panel.appendChild(again);

    var wrongIds = r.details.filter(function (d) { return !d.ok; }).map(function (d) { return d.id; });
    if (wrongIds.length) {
      var toWrong = el("button", "btn", "Разобрать ошибки (" + wrongIds.length + ")");
      toWrong.style.marginLeft = "10px";
      toWrong.addEventListener("click", function () {
        setChapterFilter(wrongIds, "ошибки экзамена");
        $("f-dom").value = ""; $("f-svc").value = ""; $("f-status").value = "all"; $("f-order").value = "id";
        applyFilters();
        show("practice");
      });
      panel.appendChild(toWrong);
    }
    box.appendChild(panel);

    var list = el("div", "panel");
    list.style.marginTop = "16px";
    list.appendChild(el("h3", "", "Разбор всех вопросов попытки"));
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
    cards.appendChild(card(st.seen + " / " + st.total, "пройдено вопросов"));
    cards.appendChild(card(st.seen ? Math.round(100 * st.right / st.seen) + "%" : "—", "точность последних ответов"));
    cards.appendChild(card(String(st.wrong), "с ошибкой"));
    cards.appendChild(card(String(st.flagged), "отмечено"));
    cards.appendChild(card(String(S.exams().length), "попыток экзамена"));
    body.appendChild(cards);

    var doms = el("div", "panel");
    doms.appendChild(el("h3", "", "По доменам"));
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
    weak.appendChild(el("h3", "", "Слабые темы"));
    var svcStats = S.statsBySvc(Q.bank).filter(function (x) { return x.seen >= 5; });
    svcStats.sort(function (a, b) { return (a.right / a.seen) - (b.right / b.seen); });
    if (!svcStats.length) {
      weak.appendChild(el("div", "empty", "Данных пока мало: ответьте хотя бы на пять вопросов по сервису."));
    } else {
      weak.appendChild(el("div", "cap", "Точность по сервисам, где отвечено не меньше пяти вопросов. Клик по строке открывает тренировку по этому сервису."));
      var t = el("table", "history weak-svc");
      t.innerHTML = "<thead><tr><th>сервис</th><th>точность</th><th>верно</th><th>отвечено</th><th>в банке</th></tr></thead>";
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
      t.appendChild(tb);
      var weakWrap = el("div", "table-wrap");
      weakWrap.appendChild(t);
      weak.appendChild(weakWrap);
    }
    body.appendChild(weak);

    var hist = el("div", "panel");
    hist.style.marginTop = "16px";
    hist.appendChild(el("h3", "", "История экзаменов"));
    var exams = S.exams();
    if (!exams.length) {
      hist.appendChild(el("div", "empty", "Попыток пока нет."));
    } else {
      hist.appendChild(el("div", "cap", "Клик по строке открывает разбор той попытки целиком."));
      var t = el("table", "history");
      t.innerHTML = "<thead><tr><th>дата</th><th>результат</th><th>верно</th><th>время</th>" +
        "<th>SEC</th><th>RES</th><th>PERF</th><th>COST</th></tr></thead>";
      var tb = el("tbody");
      exams.forEach(function (r) {
        var tr = el("tr", "replay");
        tr.title = "открыть разбор этой попытки";
        tr.addEventListener("click", function () { show("exam"); renderExamResult(r); });
        var cells = [
          new Date(r.ts).toLocaleString("ru-RU"),
          r.score + "%",
          r.right + "/" + r.total,
          Math.floor(r.spent / 60) + " мин"
        ];
        ["SEC", "RES", "PERF", "COST"].forEach(function (d) {
          var s = r.byDom[d] || { total: 0, right: 0 };
          cells.push(s.right + "/" + s.total);
        });
        cells.forEach(function (c) { tr.appendChild(el("td", "", c)); });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      var histWrap = el("div", "table-wrap");
      histWrap.appendChild(t);
      hist.appendChild(histWrap);
    }
    body.appendChild(hist);

    var tools = el("div", "panel");
    tools.style.marginTop = "16px";
    tools.appendChild(el("h3", "", "Данные"));
    var exportBtn = el("button", "btn", "Скопировать прогресс в буфер");
    exportBtn.addEventListener("click", function () {
      var text = S.export();
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      else window.prompt("Скопируйте JSON прогресса", text);
      exportBtn.textContent = "Скопировано";
      setTimeout(function () { exportBtn.textContent = "Скопировать прогресс в буфер"; }, 1500);
    });
    var importBtn = el("button", "btn", "Вставить прогресс");
    importBtn.style.marginLeft = "10px";
    importBtn.addEventListener("click", function () {
      var text = window.prompt("Вставьте ранее сохранённый JSON прогресса");
      if (!text) return;
      try { S.import(text); renderProgress(); } catch (e) { alert("Не разобрал JSON: " + e.message); }
    });
    var resetBtn = el("button", "btn ghost", "Сбросить прогресс");
    resetBtn.style.marginLeft = "10px";
    resetBtn.addEventListener("click", function () {
      if (!confirm("Удалить весь прогресс: ответы, отметки, историю экзаменов?")) return;
      S.reset();
      renderProgress();
      applyFilters();
    });
    tools.appendChild(exportBtn);
    tools.appendChild(importBtn);
    tools.appendChild(resetBtn);
    body.appendChild(tools);
  }

  /* ---------------- запуск ---------------- */

  function init() {
    $("bank-info").textContent = "банк " + Q.bank.length + " вопросов · аудит " + Q.meta.audited +
      " · глав учебника " + T.chapters.length;

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
        setChapterFilter(c.questions, c.title);
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
      if (unanswered && !confirm("Без ответа осталось " + unanswered + ". Завершить?")) return;
      exam.finish();
    });

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
