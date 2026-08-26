# SAA-C03 Trainer — Android app

A Capacitor shell around the same offline web app that lives in `web/`. No separate UI,
no separate data: the APK bundles the bank, the handbook and the walkthroughs, so the
app works with no network at all — it does not even request the `INTERNET` permission.

| | |
|---|---|
| package | `com.nickelface.saatrainer` |
| min SDK | 23 (Android 6) |
| target SDK | 35 (Android 15) |
| size | ~6 MB |

## Build

Requires JDK 21, the Android SDK and Node 22.

```bash
cd mobile
npm ci
npm run apk        # www -> cap sync -> gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run www` calls `../scripts/build-app.sh`, which copies `web/` into `mobile/www`,
adds `images/exhibits`, drops the service worker (the APK is the offline copy) and
injects the Capacitor runtime as plain `<script>` tags — the web app has no bundler and
does not need one here either.

A signed release build picks the keystore up from the environment; without these
variables `assembleRelease` produces an unsigned APK:

```bash
SAA_KEYSTORE=/path/to/saa.keystore SAA_KEYSTORE_PASSWORD=… \
SAA_KEY_ALIAS=… SAA_KEY_PASSWORD=… npm run apk:release
```

CI builds a debug APK on demand: the **Android APK** workflow (`workflow_dispatch`, or a
`v*` tag) uploads it as an artifact.

## What the shell adds

- hardware **Back**: leaves chapter reading mode, closes the filter panel, drops the
  chapter filter, returns to Practice, and only then exits the app;
- dark system bars and an adaptive launcher icon in the app's own palette;
- `adjustMarginsForEdgeToEdge: force` — Android 15 draws under the system bars, and
  without it the tab row ends up beneath the status bar clock.

Everything else — practice, exam, handbook, progress — is the web app, byte for byte.
Progress lives in the WebView's localStorage and survives restarts; the JSON
export/import on the Progress tab moves it between the phone and the browser.
