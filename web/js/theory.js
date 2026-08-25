/* Учебник: список глав, поиск, чтение, переход к вопросам по теме. */
(function (global) {
  "use strict";

  var CHAPTERS = (global.SAA_THEORY && global.SAA_THEORY.chapters) || [];
  var BY_ID = {};
  CHAPTERS.forEach(function (c) { BY_ID[c.id] = c; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function chaptersForServices(svc) {
    if (!svc || !svc.length) return [];
    return CHAPTERS.filter(function (c) {
      return c.svc.some(function (s) { return svc.indexOf(s) !== -1; });
    });
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (q.length < 2) return CHAPTERS.slice();
    return CHAPTERS.filter(function (c) {
      return c.title.toLowerCase().indexOf(q) !== -1 ||
        c.svc.join(" ").toLowerCase().indexOf(q) !== -1 ||
        (c.text || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  function View(dom, handlers) {
    this.dom = dom;              /* { list, body, search } */
    this.handlers = handlers || {};
    this.activeId = null;
    var self = this;
    dom.search.addEventListener("input", function () { self.renderList(); });
  }

  View.prototype.renderList = function () {
    var self = this;
    var found = search(this.dom.search.value || "");
    this.dom.list.innerHTML = "";
    if (!CHAPTERS.length) {
      var li = el("li");
      li.appendChild(el("div", "empty", "Главы ещё не собраны: scripts/build-theory.py"));
      this.dom.list.appendChild(li);
      return;
    }
    found.forEach(function (c) {
      var li = el("li");
      var a = el("a", c.id === self.activeId ? "active" : "");
      a.href = "#";
      a.appendChild(el("span", "num", String(c.order)));
      a.appendChild(document.createTextNode(c.title));
      a.addEventListener("click", function (e) { e.preventDefault(); self.open(c.id); });
      li.appendChild(a);
      self.dom.list.appendChild(li);
    });
    if (!found.length) {
      var none = el("li");
      none.appendChild(el("div", "empty", "Ничего не найдено"));
      this.dom.list.appendChild(none);
    }
  };

  View.prototype.open = function (id) {
    var self = this;
    var c = BY_ID[id];
    if (!c) return;
    this.activeId = id;
    this.renderList();

    var body = this.dom.body;
    body.innerHTML = "";

    var head = el("div", "chapter-head");
    head.appendChild(el("h1", "", c.title));
    body.appendChild(head);

    var meta = el("div", "chapter-head");
    c.svc.forEach(function (s) { meta.appendChild(el("span", "chip", s)); });
    if (c.questions.length) {
      var btn = el("button", "btn primary", "Порешать вопросы главы (" + c.questions.length + ")");
      btn.addEventListener("click", function () {
        if (self.handlers.onPractice) self.handlers.onPractice(c);
      });
      meta.appendChild(btn);
    }
    body.appendChild(meta);

    var article = el("div");
    article.innerHTML = c.html;
    body.appendChild(article);

    /* ссылки вида {{q:12,45}} превращены сборкой в a.qref */
    article.querySelectorAll("a.qref").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var ids = a.dataset.q.split(",").map(function (x) { return parseInt(x.trim(), 10); })
          .filter(function (x) { return !isNaN(x); });
        if (self.handlers.onQuestions) self.handlers.onQuestions(ids, c.title);
      });
    });

    /* навигация по главам внизу: предыдущая и следующая по порядку */
    var ordered = CHAPTERS.slice().sort(function (a, b) { return a.order - b.order; });
    var pos = ordered.map(function (x) { return x.id; }).indexOf(c.id);
    var nav = el("div", "chapter-nav");
    function navBtn(target, label) {
      var b = el("button", "btn ghost", label);
      b.addEventListener("click", function () { self.open(target.id); });
      return b;
    }
    if (pos > 0) nav.appendChild(navBtn(ordered[pos - 1], "← " + ordered[pos - 1].title));
    nav.appendChild(el("span", "spacer", ""));
    if (pos !== -1 && pos < ordered.length - 1) {
      nav.appendChild(navBtn(ordered[pos + 1], ordered[pos + 1].title + " →"));
    }
    body.appendChild(nav);

    body.scrollIntoView({ block: "start" });
  };

  global.SAA_Theory = {
    chapters: CHAPTERS,
    byId: BY_ID,
    chaptersForServices: chaptersForServices,
    search: search,
    View: View
  };
})(window);
