/* Прогресс в localStorage. Единственное место, где живёт состояние между сессиями. */
(function (global) {
  "use strict";

  var KEY = "saa-c03:v1";
  var EMPTY = { answered: {}, flagged: [], exams: [], current: null };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(EMPTY);
      var data = JSON.parse(raw);
      return {
        answered: data.answered || {},
        flagged: data.flagged || [],
        exams: data.exams || [],
        current: data.current || null
      };
    } catch (e) {
      console.warn("прогресс не прочитан, начинаем с чистого:", e);
      return clone(EMPTY);
    }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = load();
  var saveTimer = null;

  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("прогресс не сохранён:", e);
      }
    }, 120);
  }

  var Storage = {
    all: function () { return state; },

    /* --- ответы --- */
    record: function (id, picked, correct) {
      var prev = state.answered[id];
      state.answered[id] = {
        picked: picked,
        correct: !!correct,
        ts: Date.now(),
        tries: (prev ? prev.tries : 0) + 1
      };
      persist();
    },
    status: function (id) { return state.answered[id] || null; },
    isAnswered: function (id) { return !!state.answered[id]; },
    isWrong: function (id) { return !!state.answered[id] && !state.answered[id].correct; },

    /* --- закладки --- */
    isFlagged: function (id) { return state.flagged.indexOf(id) !== -1; },
    toggleFlag: function (id) {
      var i = state.flagged.indexOf(id);
      if (i === -1) state.flagged.push(id); else state.flagged.splice(i, 1);
      persist();
      return this.isFlagged(id);
    },

    /* --- незавершённый экзамен --- */
    saveCurrentExam: function (exam) { state.current = exam; persist(); },
    currentExam: function () { return state.current; },
    clearCurrentExam: function () { state.current = null; persist(); },

    /* --- история попыток --- */
    pushExam: function (result) {
      state.exams.unshift(result);
      state.exams = state.exams.slice(0, 50);
      persist();
    },
    exams: function () { return state.exams; },

    /* --- сервис --- */
    reset: function () {
      state = clone(EMPTY);
      try { localStorage.removeItem(KEY); } catch (e) { /* приватный режим */ }
    },
    export: function () { return JSON.stringify(state, null, 1); },
    import: function (text) {
      var data = JSON.parse(text);
      state = {
        answered: data.answered || {},
        flagged: data.flagged || [],
        exams: data.exams || [],
        current: data.current || null
      };
      persist();
    },

    stats: function (questions) {
      var s = { total: questions.length, seen: 0, right: 0, wrong: 0, flagged: state.flagged.length, byDom: {} };
      questions.forEach(function (q) {
        var d = s.byDom[q.dom] || (s.byDom[q.dom] = { total: 0, seen: 0, right: 0 });
        d.total++;
        var a = state.answered[q.id];
        if (!a) return;
        s.seen++; d.seen++;
        if (a.correct) { s.right++; d.right++; } else { s.wrong++; }
      });
      return s;
    }
  };

  global.SAA_Storage = Storage;
})(window);
