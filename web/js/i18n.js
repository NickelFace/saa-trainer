/* Строковая таблица интерфейса + переключение языка (RU/EN).
   String table for the UI + language switching (RU/EN).

   t(key, ...vals)   — достаёт строку по ключу для текущего языка, подставляет
                        {0}, {1}, ... из vals; если строки нет для текущего
                        языка, падает на русскую, а если нет и там — возвращает
                        сам ключ.
   setLocale(locale)  — переключает язык, сохраняет выбор и уведомляет подписчиков.
   getLocale()         — текущий язык ("ru" | "en").
   onChange(fn)        — подписка на смену языка.
*/
(function (global) {
  "use strict";

  var KEY = "saa-c03:lang";

  var STRINGS = {
    ru: {
      metaDescription: "Офлайн-тренажёр и учебник для экзамена AWS Certified Solutions Architect – Associate (SAA-C03)",
      tabPractice: "Тренировка",
      tabExam: "Экзамен",
      tabTheory: "Учебник",
      tabProgress: "Прогресс",

      filtersToggleOpen: "Фильтры ▴",
      filtersToggleClosed: "Фильтры ▾",
      filterDomain: "Домен",
      filterAll: "все",
      filterService: "Сервис",
      filterStatus: "Статус",
      statusAll: "все",
      statusUnseen: "не отвеченные",
      statusWrong: "ошибочные",
      statusCorrect: "решённые верно",
      statusFlagged: "отмеченные",
      statusCorrected: "исправленный ключ",
      statusDisputed: "спорные",
      statusManual: "домен размечен вручную",
      filterOrder: "Порядок",
      orderId: "по номеру",
      orderRandom: "случайно",
      filterSearch: "Поиск",
      searchPlaceholder: "номер вопроса или текст",
      applyBtn: "Применить",
      practiceEmpty: "Под фильтр ничего не подходит.",
      questionsCount: "{0} вопр.",
      quoted: "«{0}»",
      chapterFilterLabel: "глава: {0} ({1}) ",
      clearChapterFilterTitle: "снять фильтр главы",

      examTitle: "Экзамен",
      examIntro: "65 вопросов по весам blueprint, таймер 130 минут. Разбор — после сдачи.",
      examExcludeSeen: "Исключить вопросы, на которые уже отвечал верно",
      examBegin: "Начать экзамен",
      examUnfinished: "Есть незавершённая попытка.",
      examContinue: "Продолжить",
      examDrop: "Сбросить",
      examFinish: "Завершить",
      examPlanChip: "{0} — {1} вопр. ({2}%)",
      examCounter: "Отвечено {0} из {1}",
      examPosition: "вопрос {0} из {1}",
      examFinishConfirm: "Без ответа осталось {0}. Завершить?",

      resultTitle: "Результат",
      resultCap: "{0} из {1} · время {2} мин {3} с · порог сдачи примерно 72%",
      resultNewExam: "Новый экзамен",
      resultReviewMistakes: "Разобрать ошибки ({0})",
      resultMistakesTitle: "ошибки экзамена",
      resultAllReview: "Разбор всех вопросов попытки",

      progressDone: "пройдено вопросов",
      progressAccuracy: "точность последних ответов",
      progressWrong: "с ошибкой",
      progressFlagged: "отмечено",
      progressAttempts: "попыток экзамена",
      progressByDomain: "По доменам",
      progressWeakTopics: "Слабые темы",
      progressWeakEmpty: "Данных пока мало: ответьте хотя бы на пять вопросов по сервису.",
      progressWeakCap: "Точность по сервисам, где отвечено не меньше пяти вопросов. Клик по строке открывает тренировку по этому сервису.",
      thService: "сервис",
      thAccuracy: "точность",
      thCorrect: "верно",
      thAnswered: "отвечено",
      thInBank: "в банке",
      progressExamHistory: "История экзаменов",
      progressNoAttempts: "Попыток пока нет.",
      progressHistoryCap: "Клик по строке открывает разбор той попытки целиком.",
      thDate: "дата",
      thResult: "результат",
      thTime: "время",
      minutesShort: "{0} мин",
      replayTitle: "открыть разбор этой попытки",
      progressData: "Данные",
      exportBtn: "Скопировать прогресс в буфер",
      exportCopied: "Скопировано",
      exportPrompt: "Скопируйте JSON прогресса",
      importBtn: "Вставить прогресс",
      importPrompt: "Вставьте ранее сохранённый JSON прогресса",
      importError: "Не разобрал JSON: {0}",
      resetBtn: "Сбросить прогресс",
      resetConfirm: "Удалить весь прогресс: ответы, отметки, историю экзаменов?",

      bankInfo: "банк {0} вопросов · аудит {1} · глав учебника {2}",

      theorySearchPlaceholder: "Поиск по учебнику",
      theoryChooseChapter: "Выберите главу из списка.",
      theoryNotBuilt: "Главы ещё не собраны: scripts/build-theory.py",
      theoryNothingFound: "Ничего не найдено",
      theoryBackToChapters: "← Главы",
      theoryPracticeChapter: "Порешать вопросы главы ({0})",

      exhibitAlt: "экспонат {0}",
      selectCount: "выбрать {0}",
      seenCorrect: "ранее верно",
      seenWrong: "ранее неверно",
      triesSuffix: " · попыток {0}",
      flagStar: "★ отметить",
      defectLabel: "Дефект исходного PDF:",
      optionAlt: "вариант {0}",
      checkBtn: "Проверить",
      nextBtn: "Дальше →",
      prevBtn: "← Назад",
      skipBtn: "Пропустить",
      positionOf: "{0} из {1}",
      kbdHint: "<kbd>1</kbd>…<kbd>6</kbd> выбрать · <kbd>Enter</kbd> проверить · <kbd>→</kbd> дальше · <kbd>f</kbd> отметить",
      reviewOfQuestionTitle: "разбор вопроса #{0}",

      verdictOk: "Верно",
      verdictBad: "Неверно. Правильный ответ: {0}",
      yourAnswer: "Ваш ответ: {0}",
      reviewDisputedTitle: "Разбор (вопрос спорный, ключ {0}):",
      reviewWhyTitle: "Почему верный ответ {0}:",
      fixNoteLabel: "Ключ дампа исправлен при аудите:",
      fixNoteArrow: " → ",
      disputedLabel: "Спорный вопрос.",
      disputedKeyAlt: "Ключ {0}, альтернатива {1}. ",
      dataNoteLabel: "Правка данных:",
      manualDomainLabel: "Домен размечен вручную:",
      manualDomainSuffix: ". Сильных маркеров в тексте нет, домен определён по требованию, которое отсекает неверные варианты. ",
      manualDomainLink: "Как это работает",
      weakDomainNote: "Домен определён по слабым маркерам: формулировка допускает и другое отнесение.",
      theoryLinksLabel: "Учебник: ",

      langToggleLabel: "Язык",
      langRu: "RU",
      langEn: "EN"
    },
    en: {
      metaDescription: "Offline practice trainer and handbook for the AWS Certified Solutions Architect – Associate (SAA-C03) exam",
      tabPractice: "Practice",
      tabExam: "Exam",
      tabTheory: "Handbook",
      tabProgress: "Progress",

      filtersToggleOpen: "Filters ▴",
      filtersToggleClosed: "Filters ▾",
      filterDomain: "Domain",
      filterAll: "all",
      filterService: "Service",
      filterStatus: "Status",
      statusAll: "all",
      statusUnseen: "unseen",
      statusWrong: "wrong",
      statusCorrect: "solved correctly",
      statusFlagged: "flagged",
      statusCorrected: "corrected key",
      statusDisputed: "disputed",
      statusManual: "manually classified domain",
      filterOrder: "Order",
      orderId: "by number",
      orderRandom: "random",
      filterSearch: "Search",
      searchPlaceholder: "question number or text",
      applyBtn: "Apply",
      practiceEmpty: "Nothing matches this filter.",
      questionsCount: "{0} questions",
      quoted: "“{0}”",
      chapterFilterLabel: "chapter: {0} ({1}) ",
      clearChapterFilterTitle: "clear the chapter filter",

      examTitle: "Exam",
      examIntro: "65 questions sampled by blueprint weights, 130-minute timer. Review is available after you finish.",
      examExcludeSeen: "Exclude questions you've already answered correctly",
      examBegin: "Start exam",
      examUnfinished: "You have an unfinished attempt.",
      examContinue: "Continue",
      examDrop: "Discard",
      examFinish: "Finish",
      examPlanChip: "{0} — {1} questions ({2}%)",
      examCounter: "Answered {0} of {1}",
      examPosition: "question {0} of {1}",
      examFinishConfirm: "{0} left unanswered. Finish anyway?",

      resultTitle: "Result",
      resultCap: "{0} of {1} · time {2}m {3}s · passing score around 72%",
      resultNewExam: "New exam",
      resultReviewMistakes: "Review mistakes ({0})",
      resultMistakesTitle: "exam mistakes",
      resultAllReview: "Review of every question in this attempt",

      progressDone: "questions completed",
      progressAccuracy: "accuracy of recent answers",
      progressWrong: "answered wrong",
      progressFlagged: "flagged",
      progressAttempts: "exam attempts",
      progressByDomain: "By domain",
      progressWeakTopics: "Weak topics",
      progressWeakEmpty: "Not enough data yet: answer at least five questions for a service.",
      progressWeakCap: "Accuracy by service, for services with at least five answers. Click a row to practice that service.",
      thService: "service",
      thAccuracy: "accuracy",
      thCorrect: "correct",
      thAnswered: "answered",
      thInBank: "in bank",
      progressExamHistory: "Exam history",
      progressNoAttempts: "No attempts yet.",
      progressHistoryCap: "Click a row to open the full review of that attempt.",
      thDate: "date",
      thResult: "result",
      thTime: "time",
      minutesShort: "{0}m",
      replayTitle: "open the review of this attempt",
      progressData: "Data",
      exportBtn: "Copy progress to clipboard",
      exportCopied: "Copied",
      exportPrompt: "Copy the progress JSON",
      importBtn: "Import progress",
      importPrompt: "Paste previously saved progress JSON",
      importError: "Could not parse JSON: {0}",
      resetBtn: "Reset progress",
      resetConfirm: "Delete all progress: answers, flags, exam history?",

      bankInfo: "bank of {0} questions · audited {1} · handbook chapters {2}",

      theorySearchPlaceholder: "Search the handbook",
      theoryChooseChapter: "Choose a chapter from the list.",
      theoryNotBuilt: "Chapters not built yet: scripts/build-theory.py",
      theoryNothingFound: "Nothing found",
      theoryBackToChapters: "← Chapters",
      theoryPracticeChapter: "Practice this chapter's questions ({0})",

      exhibitAlt: "exhibit {0}",
      selectCount: "select {0}",
      seenCorrect: "previously correct",
      seenWrong: "previously wrong",
      triesSuffix: " · attempts {0}",
      flagStar: "★ flag",
      defectLabel: "Source PDF defect:",
      optionAlt: "option {0}",
      checkBtn: "Check",
      nextBtn: "Next →",
      prevBtn: "← Back",
      skipBtn: "Skip",
      positionOf: "{0} of {1}",
      kbdHint: "<kbd>1</kbd>…<kbd>6</kbd> select · <kbd>Enter</kbd> check · <kbd>→</kbd> next · <kbd>f</kbd> flag",
      reviewOfQuestionTitle: "review of question #{0}",

      verdictOk: "Correct",
      verdictBad: "Incorrect. The correct answer: {0}",
      yourAnswer: "Your answer: {0}",
      reviewDisputedTitle: "Walkthrough (this question is disputed, key {0}):",
      reviewWhyTitle: "Why the correct answer is {0}:",
      fixNoteLabel: "The dump key was corrected during the audit:",
      fixNoteArrow: " → ",
      disputedLabel: "Disputed question.",
      disputedKeyAlt: "Key {0}, alternative {1}. ",
      dataNoteLabel: "Data correction:",
      manualDomainLabel: "Manually classified domain:",
      manualDomainSuffix: ". There are no strong markers in the text; the domain was decided from the requirement that rules out the wrong options. ",
      manualDomainLink: "How this works",
      weakDomainNote: "The domain was decided from weak markers: the wording allows another reading.",
      theoryLinksLabel: "Handbook: ",

      langToggleLabel: "Language",
      langRu: "RU",
      langEn: "EN"
    }
  };

  var locale = "ru";
  var listeners = [];

  function detect() {
    try {
      var saved = global.localStorage && global.localStorage.getItem(KEY);
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) { /* приватный режим / недоступно */ }
    return "ru";
  }

  function fmt(str, args) {
    return String(str).replace(/\{(\d+)\}/g, function (m, i) {
      var v = args[i];
      return v == null ? m : v;
    });
  }

  function t(key) {
    var args = Array.prototype.slice.call(arguments, 1);
    var table = STRINGS[locale] || STRINGS.ru;
    var str = table[key];
    if (str == null) str = STRINGS.ru[key];
    if (str == null) return key;
    return fmt(str, args);
  }

  function getLocale() { return locale; }

  function onChange(fn) { listeners.push(fn); }

  function setLocale(l) {
    if (l !== "ru" && l !== "en") return;
    if (l === locale) return;
    locale = l;
    try { global.localStorage && global.localStorage.setItem(KEY, l); } catch (e) { /* приватный режим */ }
    if (global.document && global.document.documentElement) {
      global.document.documentElement.lang = l;
    }
    listeners.slice().forEach(function (fn) { fn(l); });
  }

  locale = detect();

  global.SAA_I18N = {
    t: t,
    setLocale: setLocale,
    getLocale: getLocale,
    onChange: onChange
  };
})(window);
