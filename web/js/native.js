/* Мост к нативной оболочке Capacitor. В обычном браузере файл ничего не делает:
   window.Capacitor там отсутствует, и весь код пропускается. */
(function (global) {
  "use strict";

  var cap = global.Capacitor;
  if (!cap || !cap.Plugins || !cap.Plugins.App) return;

  document.documentElement.classList.add("native");

  var App = cap.Plugins.App;

  /* аппаратная кнопка «назад»: сначала откатываем состояние интерфейса,
     и только когда откатывать нечего — выходим из приложения */
  App.addListener("backButton", function () {
    if (global.SAA_App && global.SAA_App.back()) return;
    App.exitApp();
  });
})(window);
