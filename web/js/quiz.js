/* Логика тренировки и экзамена + отрисовка карточки вопроса.
   Practice/exam logic + question card rendering. Question stems and options are
   English in the bank already; only the editorial annotation fields (dom_why,
   fix_note, disputed_note, note, defect) and the walkthroughs (SAA_EXPLAIN) carry
   a separate English copy, picked via locale() below with RU fallback. */
(function (global) {
  "use strict";

  var S = global.SAA_Storage;
  var I = global.SAA_I18N;
  var t = I.t;
  var DATA = global.SAA_DATA;
  var BANK = DATA.questions;
  var META = DATA.meta;
  var BY_ID = {};
  BANK.forEach(function (q) { BY_ID[q.id] = q; });

  /* база для картинок-экспонатов: локально приложение лежит в web/, на сайте — в корне */
  var EXHIBITS = (global.SAA_CONFIG && global.SAA_CONFIG.exhibits) || "../images/exhibits/";

  var DOM_NAMES = {};
  META.domains.forEach(function (d) { DOM_NAMES[d.code] = d.name; });

  /* ---------------- локализация данных банка ---------------- */

  /* аннотационные поля вопроса (dom_why, fix_note, disputed_note, note, defect):
     на английском лежат в полях с суффиксом _en, если перевод есть; иначе — RU. */
  function loc(q, field) {
    if (I.getLocale() === "en" && q[field + "_en"]) return q[field + "_en"];
    return q[field];
  }

  /* разборы вопросов: отдельный объект на язык, с фолбэком на RU по каждому id */
  function explainFor(id) {
    var ru = (global.SAA_EXPLAIN || {})[id];
    if (I.getLocale() !== "en") return ru;
    var en = (global.SAA_EXPLAIN_EN || {})[id];
    return en || ru;
  }

  /* ---------------- утилиты ---------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function letters(answer) { return String(answer || "").split(""); }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function exhibitImg(file) {
    var img = el("img", "exhibit");
    img.src = EXHIBITS + file;
    img.alt = t("exhibitAlt", file);
    img.loading = "lazy";
    return img;
  }

  /* ---------------- карточка вопроса ----------------
     mode: practice | exam | review
     h: { onPick, onCheck, onNext, onPrev, onFlag, onTheory }
  */
  function buildCard(q, view, h) {
    var card = el("div", "qcard");

    /* шапка */
    var head = el("div", "qhead");
    head.appendChild(el("span", "qid", "#" + q.id));
    var domChip = el("span", "chip dom-" + q.dom, q.dom);
    domChip.appendChild(el("span", "dom-full", " · " + DOM_NAMES[q.dom]));
    domChip.title = q.dom + " · " + DOM_NAMES[q.dom];
    head.appendChild(domChip);
    if (q.multi) head.appendChild(el("span", "chip", t("selectCount", q.answer.length)));
    (q.svc || []).slice(0, 5).forEach(function (s) { head.appendChild(el("span", "chip weak", s)); });

    /* уже отвечали на этот вопрос — показываем прошлый результат */
    var prev = S.status(q.id);
    if (prev && view.mode !== "exam") {
      head.appendChild(el("span", "chip " + (prev.correct ? "seen-ok" : "seen-bad"),
        (prev.correct ? t("seenCorrect") : t("seenWrong")) + (prev.tries > 1 ? t("triesSuffix", prev.tries) : "")));
    }

    var flag = el("span", "chip flag" + (S.isFlagged(q.id) ? " on" : ""), t("flagStar"));
    flag.addEventListener("click", function () {
      var on = S.toggleFlag(q.id);
      flag.className = "chip flag" + (on ? " on" : "");
      if (h.onFlag) h.onFlag(q.id, on);
    });
    head.appendChild(flag);
    card.appendChild(head);

    /* текст и экспонаты */
    card.appendChild(el("div", "qtext", q.question));
    (q.exhibits || []).forEach(function (f) {
      if (q.options.some(function (o) { return o.img; }) && /-[A-F]\.png$/.test(f)) return;
      card.appendChild(exhibitImg(f));
    });
    if (q.defect) {
      var d = el("div", "note defect");
      d.innerHTML = "<b>" + t("defectLabel") + "</b> " + loc(q, "defect");
      card.appendChild(d);
    }

    /* варианты */
    var picked = view.picked || [];
    var revealed = !!view.revealed;
    var correct = letters(q.answer);
    var opts = el("div", "options");

    q.options.forEach(function (o) {
      var row = el("div", "opt");
      row.dataset.letter = o.l;
      if (picked.indexOf(o.l) !== -1) row.classList.add("picked");
      if (revealed) {
        if (correct.indexOf(o.l) !== -1) row.classList.add("correct");
        else if (picked.indexOf(o.l) !== -1) row.classList.add("wrong");
      }
      row.appendChild(el("span", "l", o.l));
      if (o.img) {
        var wrap = el("span");
        var im = el("img");
        im.src = EXHIBITS + o.img;
        im.alt = t("optionAlt", o.l);
        wrap.appendChild(im);
        row.appendChild(wrap);
      } else {
        row.appendChild(el("span", "t", o.t));
      }
      row.addEventListener("click", function () {
        if (revealed) return;
        h.onPick(o.l);
      });
      opts.appendChild(row);

      /* почему этот вариант неверен — показываем только после проверки */
      var ex = explainFor(q.id);
      if (revealed && ex && ex.opts && ex.opts[o.l]) {
        var why = el("div", "opt-why" + (correct.indexOf(o.l) !== -1 ? " ok" : ""), ex.opts[o.l]);
        opts.appendChild(why);
      }
    });
    card.appendChild(opts);

    /* кнопки */
    var actions = el("div", "qactions");
    if (view.mode === "practice") {
      if (!revealed) {
        var check = el("button", "btn primary", t("checkBtn"));
        check.disabled = picked.length === 0;
        check.addEventListener("click", h.onCheck);
        actions.appendChild(check);
      } else {
        var next = el("button", "btn primary", t("nextBtn"));
        next.addEventListener("click", h.onNext);
        actions.appendChild(next);
      }
      var prevBtn = el("button", "btn ghost", t("prevBtn"));
      prevBtn.addEventListener("click", h.onPrev);
      actions.appendChild(prevBtn);
      var skip = el("button", "btn ghost", t("skipBtn"));
      skip.addEventListener("click", h.onNext);
      actions.appendChild(skip);
    } else if (view.mode === "exam") {
      var pv = el("button", "btn ghost", t("prevBtn"));
      pv.addEventListener("click", h.onPrev);
      actions.appendChild(pv);
      var nx = el("button", "btn primary", t("nextBtn"));
      nx.addEventListener("click", h.onNext);
      actions.appendChild(nx);
    }
    var pos = el("span", "spacer", view.position || "");
    actions.appendChild(pos);
    card.appendChild(actions);

    if (view.mode === "practice") {
      var hint = el("div", "kbd-hint");
      hint.innerHTML = t("kbdHint");
      card.appendChild(hint);
    }

    /* разбор */
    if (revealed) card.appendChild(buildReview(q, picked, h));

    /* ссылки на родственные вопросы: они есть и в разборе, и в опровержениях вариантов */
    bindQrefs(card, h, { key: "reviewOfQuestionTitle", args: [q.id] });
    return card;
  }

  function bindQrefs(root, h, title) {
    root.querySelectorAll("a.qref").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        if (!h.onQuestions) return;
        var ids = a.dataset.q.split(",").map(function (x) { return parseInt(x.trim(), 10); })
          .filter(function (x) { return !isNaN(x); });
        if (ids.length) h.onQuestions(ids, title);
      });
    });
  }

  function buildReview(q, picked, h) {
    var box = el("div", "review");
    var right = sameSet(picked, letters(q.answer));
    var v = el("div", "verdict " + (right ? "ok" : "bad"),
      right ? t("verdictOk") : t("verdictBad", q.answer));
    box.appendChild(v);
    if (!right) box.appendChild(el("div", "", t("yourAnswer", picked.join("") || "—")));

    var ex = explainFor(q.id);
    if (ex && ex.key) {
      var k = el("div", "note explain");
      var title = q.disputed_alt ? t("reviewDisputedTitle", q.answer) : t("reviewWhyTitle", q.answer);
      k.innerHTML = "<b>" + title + "</b> " + ex.key;
      box.appendChild(k);
    }

    if (q.answer_original) {
      var f = el("div", "note fix");
      f.innerHTML = "<b>" + t("fixNoteLabel") + "</b> " + q.answer_original +
        t("fixNoteArrow") + "<b>" + q.answer + "</b>. " + (loc(q, "fix_note") || "");
      box.appendChild(f);
    }
    if (q.disputed_alt) {
      var dz = el("div", "note disputed");
      dz.innerHTML = "<b>" + t("disputedLabel") + "</b> " + t("disputedKeyAlt", q.answer, q.disputed_alt) +
        (loc(q, "disputed_note") || "");
      box.appendChild(dz);
    }
    if (q.note) {
      var nt = el("div", "note");
      nt.innerHTML = "<b>" + t("dataNoteLabel") + "</b> " + loc(q, "note");
      box.appendChild(nt);
    }
    if (q.dom_conf === "manual") {
      var dc = el("div", "note");
      dc.innerHTML = "<b>" + t("manualDomainLabel") + "</b> " + (loc(q, "dom_why") || "") + t("manualDomainSuffix");
      var da = el("a", "", t("manualDomainLink"));
      da.href = "#";
      da.addEventListener("click", function (e) { e.preventDefault(); h.onTheory("appendix-domains"); });
      dc.appendChild(da);
      box.appendChild(dc);
    } else if (q.dom_conf === "weak") {
      var dw = el("div", "note");
      dw.textContent = t("weakDomainNote");
      box.appendChild(dw);
    }

    var chapters = global.SAA_Theory ? global.SAA_Theory.chaptersForServices(q.svc || []) : [];
    if (chapters.length) {
      var links = el("div", "theory-links");
      links.appendChild(el("span", "", t("theoryLinksLabel")));
      chapters.slice(0, 3).forEach(function (c) {
        var a = el("a", "", c.title);
        a.href = "#";
        a.addEventListener("click", function (e) { e.preventDefault(); h.onTheory(c.id); });
        links.appendChild(a);
      });
      box.appendChild(links);
    }
    return box;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort().join(""), y = b.slice().sort().join("");
    return x === y;
  }

  /* ---------------- тренировка ---------------- */

  function Practice(mount, handlers) {
    this.mount = mount;
    this.handlers = handlers || {};
    this.list = [];
    this.i = 0;
    this.picked = [];
    this.revealed = false;
  }

  Practice.prototype.setList = function (list) {
    this.list = list;
    this.i = 0;
    this.picked = [];
    this.revealed = false;
    this.render();
  };

  Practice.prototype.current = function () { return this.list[this.i]; };

  Practice.prototype.pick = function (letter) {
    var q = this.current();
    if (!q || this.revealed) return;
    if (q.multi) {
      var idx = this.picked.indexOf(letter);
      if (idx === -1) {
        if (this.picked.length >= q.answer.length) this.picked.shift();
        this.picked.push(letter);
      } else {
        this.picked.splice(idx, 1);
      }
    } else {
      this.picked = [letter];
    }
    this.render();
  };

  Practice.prototype.check = function () {
    var q = this.current();
    if (!q || this.revealed || !this.picked.length) return;
    this.revealed = true;
    S.record(q.id, this.picked.slice().sort().join(""), sameSet(this.picked, letters(q.answer)));
    this.render();
  };

  /* перейти к вопросу с указанным номером внутри текущей выборки */
  Practice.prototype.jumpToId = function (id) {
    var idx = -1;
    for (var i = 0; i < this.list.length; i++) {
      if (this.list[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return false;
    this.i = idx;
    this.picked = [];
    this.revealed = false;
    this.render();
    return true;
  };

  Practice.prototype.go = function (delta) {
    if (!this.list.length) return;
    this.i = (this.i + delta + this.list.length) % this.list.length;
    this.picked = [];
    this.revealed = false;
    this.render();
  };

  Practice.prototype.render = function () {
    var self = this;
    this.mount.innerHTML = "";
    var q = this.current();
    if (!q) return;
    var card = buildCard(q, {
      mode: "practice",
      picked: this.picked,
      revealed: this.revealed,
      position: t("positionOf", this.i + 1, this.list.length)
    }, {
      onPick: function (l) { self.pick(l); },
      onCheck: function () { self.check(); },
      onNext: function () { self.go(1); },
      onPrev: function () { self.go(-1); },
      onFlag: function () { if (self.handlers.onFlag) self.handlers.onFlag(); },
      onTheory: function (id) { if (self.handlers.onTheory) self.handlers.onTheory(id); },
      onQuestions: function (ids, title) { if (self.handlers.onQuestions) self.handlers.onQuestions(ids, title); }
    });
    this.mount.appendChild(card);
  };

  Practice.prototype.key = function (e) {
    var q = this.current();
    if (!q) return;
    if (e.key >= "1" && e.key <= "6") {
      var idx = parseInt(e.key, 10) - 1;
      if (q.options[idx]) this.pick(q.options[idx].l);
      e.preventDefault();
    } else if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "b" || e.key.toLowerCase() === "c" ||
               e.key.toLowerCase() === "d" || e.key.toLowerCase() === "e") {
      var L = e.key.toUpperCase();
      if (q.options.some(function (o) { return o.l === L; })) this.pick(L);
    } else if (e.key === "Enter") {
      if (this.revealed) this.go(1); else this.check();
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      this.go(1);
    } else if (e.key === "ArrowLeft") {
      this.go(-1);
    } else if (e.key.toLowerCase() === "f") {
      S.toggleFlag(q.id);
      this.render();
    }
  };

  /* ---------------- фильтрация банка ---------------- */

  function filter(opts) {
    var list = BANK.filter(function (q) {
      if (opts.ids && opts.ids.indexOf(q.id) === -1) return false;
      if (opts.dom && q.dom !== opts.dom) return false;
      if (opts.svc && (q.svc || []).indexOf(opts.svc) === -1) return false;
      if (opts.text) {
        var needle = opts.text;
        var hay = (q.question + " " + q.options.map(function (o) { return o.t || ""; }).join(" ")).toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
      }
      switch (opts.status) {
        case "unseen": return !S.isAnswered(q.id);
        case "correct": return !!S.status(q.id) && S.status(q.id).correct;
        case "wrong": return S.isWrong(q.id);
        case "flagged": return S.isFlagged(q.id);
        case "corrected": return !!q.answer_original;
        case "disputed": return !!q.disputed_alt;
        case "manual": return q.dom_conf === "manual";
        default: return true;
      }
    });
    return opts.order === "random" ? shuffle(list) : list;
  }

  /* ---------------- экзамен ---------------- */

  function sampleExam(excludeCorrect) {
    var pool = {};
    BANK.forEach(function (q) { (pool[q.dom] || (pool[q.dom] = [])).push(q); });
    var picked = [];
    META.domains.forEach(function (d) {
      var avail = pool[d.code] || [];
      if (excludeCorrect) {
        var fresh = avail.filter(function (q) {
          var a = S.status(q.id);
          return !a || !a.correct;
        });
        if (fresh.length >= d.exam) avail = fresh;
      }
      picked = picked.concat(shuffle(avail).slice(0, d.exam));
    });
    return shuffle(picked).map(function (q) { return q.id; });
  }

  function Exam(dom, handlers) {
    this.dom = dom;              /* { card, grid, counter, timer } */
    this.handlers = handlers || {};
    this.state = null;
    this.tick = null;
  }

  Exam.prototype.start = function (excludeCorrect) {
    this.state = {
      ids: sampleExam(excludeCorrect),
      answers: {},
      i: 0,
      started: Date.now(),
      deadline: Date.now() + META.exam.minutes * 60000
    };
    S.saveCurrentExam(this.state);
    this.run();
  };

  Exam.prototype.resume = function () {
    var st = S.currentExam();
    if (!st) return false;
    this.state = st;
    this.run();
    return true;
  };

  Exam.prototype.run = function () {
    var self = this;
    this.render();
    if (this.tick) clearInterval(this.tick);
    this.tick = setInterval(function () { self.renderTimer(); }, 1000);
    this.renderTimer();
  };

  Exam.prototype.stop = function () {
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
  };

  Exam.prototype.renderTimer = function () {
    if (!this.state) return;
    var left = Math.max(0, this.state.deadline - Date.now());
    var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    this.dom.timer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    this.dom.timer.className = "timer" + (left < 10 * 60000 ? " low" : "");
    if (left <= 0) this.finish();
  };

  Exam.prototype.pick = function (letter) {
    var q = BY_ID[this.state.ids[this.state.i]];
    var cur = this.state.answers[q.id] || [];
    if (q.multi) {
      var idx = cur.indexOf(letter);
      if (idx === -1) {
        if (cur.length >= q.answer.length) cur.shift();
        cur.push(letter);
      } else {
        cur.splice(idx, 1);
      }
    } else {
      cur = [letter];
    }
    this.state.answers[q.id] = cur;
    S.saveCurrentExam(this.state);
    this.render();
  };

  Exam.prototype.go = function (delta) {
    this.state.i = Math.min(this.state.ids.length - 1, Math.max(0, this.state.i + delta));
    S.saveCurrentExam(this.state);
    this.render();
  };

  Exam.prototype.jump = function (i) {
    this.state.i = i;
    S.saveCurrentExam(this.state);
    this.render();
  };

  Exam.prototype.render = function () {
    var self = this;
    var st = this.state;
    var q = BY_ID[st.ids[st.i]];
    this.dom.card.innerHTML = "";
    this.dom.card.appendChild(buildCard(q, {
      mode: "exam",
      picked: st.answers[q.id] || [],
      revealed: false,
      position: t("examPosition", st.i + 1, st.ids.length)
    }, {
      onPick: function (l) { self.pick(l); },
      onNext: function () { self.go(1); },
      onPrev: function () { self.go(-1); },
      onFlag: function () { self.render(); },
      onTheory: function () {}
    }));

    this.dom.counter.textContent = t("examCounter",
      Object.keys(st.answers).filter(function (k) { return st.answers[k].length; }).length,
      st.ids.length);

    this.dom.grid.innerHTML = "";
    st.ids.forEach(function (id, i) {
      var b = el("button", "", String(i + 1));
      if ((st.answers[id] || []).length) b.classList.add("answered");
      if (S.isFlagged(id)) b.classList.add("flagged");
      if (i === st.i) b.classList.add("current");
      b.addEventListener("click", function () { self.jump(i); });
      self.dom.grid.appendChild(b);
    });
  };

  Exam.prototype.key = function (e) {
    var q = BY_ID[this.state.ids[this.state.i]];
    if (e.key >= "1" && e.key <= "6") {
      var o = q.options[parseInt(e.key, 10) - 1];
      if (o) this.pick(o.l);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      this.go(1);
    } else if (e.key === "ArrowLeft") {
      this.go(-1);
    }
  };

  Exam.prototype.finish = function () {
    this.stop();
    var st = this.state;
    var byDom = {};
    var details = [];
    st.ids.forEach(function (id) {
      var q = BY_ID[id];
      var picked = st.answers[id] || [];
      var ok = sameSet(picked, letters(q.answer));
      var d = byDom[q.dom] || (byDom[q.dom] = { total: 0, right: 0 });
      d.total++;
      if (ok) d.right++;
      S.record(q.id, picked.slice().sort().join(""), ok);
      details.push({ id: id, picked: picked.join(""), ok: ok });
    });
    var right = details.filter(function (d) { return d.ok; }).length;
    var result = {
      ts: Date.now(),
      spent: Math.round((Date.now() - st.started) / 1000),
      total: st.ids.length,
      right: right,
      score: Math.round(1000 * right / st.ids.length) / 10,
      byDom: byDom,
      details: details
    };
    S.pushExam(result);
    S.clearCurrentExam();
    this.state = null;
    if (this.handlers.onFinish) this.handlers.onFinish(result);
  };

  global.SAA_Quiz = {
    bank: BANK,
    byId: BY_ID,
    meta: META,
    domNames: DOM_NAMES,
    el: el,
    letters: letters,
    sameSet: sameSet,
    buildCard: buildCard,
    bindQrefs: bindQrefs,
    filter: filter,
    Practice: Practice,
    Exam: Exam,
    sampleExam: sampleExam
  };
})(window);
