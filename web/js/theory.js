/* Учебник: список глав, поиск, чтение, переход к вопросам по теме.
   Handbook: chapter list, search, reading, jump to related questions.
   Chapters come from SAA_THEORY (RU) or SAA_THEORY_EN (EN) depending on the active
   locale — chapters() below always reads the live SAA_I18N locale, so a language
   switch just needs the view to be re-rendered, no extra plumbing. */
(function (global) {
  "use strict";

  var I = global.SAA_I18N;
  var t = I.t;

  function chapters() {
    if (I.getLocale() === "en" && global.SAA_THEORY_EN && global.SAA_THEORY_EN.chapters &&
        global.SAA_THEORY_EN.chapters.length) {
      return global.SAA_THEORY_EN.chapters;
    }
    return (global.SAA_THEORY && global.SAA_THEORY.chapters) || [];
  }

  function byId(id) {
    var list = chapters();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function chaptersForServices(svc) {
    if (!svc || !svc.length) return [];
    return chapters().filter(function (c) {
      return c.svc.some(function (s) { return svc.indexOf(s) !== -1; });
    });
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    var list = chapters();
    if (q.length < 2) return list.slice();
    return list.filter(function (c) {
      return c.title.toLowerCase().indexOf(q) !== -1 ||
        c.svc.join(" ").toLowerCase().indexOf(q) !== -1 ||
        (c.text || "").toLowerCase().indexOf(q) !== -1;
    });
  }

  var NARROW = "(max-width: 820px)";
  function isNarrow() { return window.matchMedia(NARROW).matches; }

  function View(dom, handlers) {
    this.dom = dom;              /* { list, body, search } */
    this.handlers = handlers || {};
    this.activeId = null;
    this.layout = dom.body.parentElement;   /* .theory-layout */
    var self = this;
    dom.search.addEventListener("input", function () { self.renderList(); });
    /* на телефоне список глав и текст главы показываются по очереди, а не друг под другом */
    window.matchMedia(NARROW).addEventListener("change", function (e) {
      if (!e.matches) self.layout.classList.remove("reading");
    });
  }

  /* вернуться от текста главы к списку глав (только узкий экран) */
  View.prototype.showList = function () {
    this.layout.classList.remove("reading");
    this.dom.list.scrollIntoView({ block: "start" });
  };

  View.prototype.renderList = function () {
    var self = this;
    var found = search(this.dom.search.value || "");
    this.dom.list.innerHTML = "";
    if (!chapters().length) {
      var li = el("li");
      li.appendChild(el("div", "empty", t("theoryNotBuilt")));
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
      none.appendChild(el("div", "empty", t("theoryNothingFound")));
      this.dom.list.appendChild(none);
    }
  };

  View.prototype.open = function (id) {
    var self = this;
    var c = byId(id);
    if (!c) return;
    this.activeId = id;
    this.renderList();

    var body = this.dom.body;
    body.innerHTML = "";

    if (isNarrow()) this.layout.classList.add("reading");

    var head = el("div", "chapter-head");
    var back = el("button", "btn ghost to-list", t("theoryBackToChapters"));
    back.addEventListener("click", function () { self.showList(); });
    head.appendChild(back);
    head.appendChild(el("h1", "", c.title));
    body.appendChild(head);

    var meta = el("div", "chapter-head");
    c.svc.forEach(function (s) { meta.appendChild(el("span", "chip", s)); });
    if (c.questions.length) {
      var btn = el("button", "btn primary", t("theoryPracticeChapter", c.questions.length));
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
    var ordered = chapters().slice().sort(function (a, b) { return a.order - b.order; });
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
    get chapters() { return chapters(); },
    byId: byId,
    chaptersForServices: chaptersForServices,
    search: search,
    View: View
  };
})(window);
