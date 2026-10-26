# The apps

TAKIP for iPhone and Android (`apps/mobile`, Capacitor 8) and for Windows, macOS and Linux
(`apps/desktop`, Electron). Each app is a native window that loads **takip.dev**. Nothing of the site
is bundled, so a web deploy reaches every app at once and the apps never need a store update for a
site change. A shell is rebuilt only when its own code changes: native settings, icons, a new
permission, a new plugin.

Publishing to the stores, and signing: [`../runbooks/app-stores.md`](../runbooks/app-stores.md).

## 1. What makes an app different from a browser tab

| | How | Where |
|---|---|---|
| The site knows it is in an app | Each shell adds `TAKIPApp/<version> (<ios\|android\|macos\|windows\|linux>)` to its user agent. The root layout reads it per request: `<html data-app="android">`, the viewport, the ads gate | `src/lib/platform/native/shell.ts`, `src/app/layout.tsx` |
| No AdSense | AdSense's policies don't allow its ads in an app's web view, so `AdsProvider inApp` never loads the script, as for embeds | `components/shell/ads/ads-provider.tsx` |
| Notch and home bar (phones) | The phone apps get `viewport-fit=cover`; the bottom bar, sheet and map controls already pad with `env(safe-area-inset-bottom)`, and the top corners (logo, account, More, route banner, drawing bar) with `env(safe-area-inset-top)`. On Android WebViews older than 140, Capacitor pads the web view itself instead (`SystemBars.insetsHandling: 'native'`), and `env()` reads 0 | `capacitor.config.ts`; the `top-[calc(…env(safe-area-inset-top))]` classes |
| Sign-in with Google or GitHub | Providers refuse embedded web views (Google: `403 disallowed_useragent`). The app opens the provider in the system browser and gets the session back as a one-time token (§2) | `src/lib/platform/native/handoff.ts`, `bridge.ts`; `src/app/app/*` |
| Connecting a provider in Settings | Not possible in the app for the same reason; the row says "Connect it on takip.dev" | `settings/parts/sign-in-methods.tsx` |
| iPhone and Sign in with Apple | App Store rule 4.8: an iPhone app offering Google or GitHub must offer Sign in with Apple too. Until `APPLE_CLIENT_*` is set on the api, the iPhone app offers email sign-in only | `appProviders()` in `handoff.ts` |
| Links | Links off takip.dev open in the system browser (Capacitor's default for hosts outside `server.url`; Electron's window-open and navigation handlers). takip.dev links open in the app once the domain association files are served (§4) | |
| Offline | Capacitor shows `www/offline.html` (`server.errorPath`), Electron its own copy: the mark, "Couldn't reach TAKIP…" and Try again, in the visitor's language from the web's catalogs | `apps/mobile/tools/native-files.mjs` |
| Saving files | Phone web views drop downloads, so `saveFile()` writes the file to the app's cache and opens the share sheet (Save to Files, Drive, Mail…); browsers and the desktop app download as before. Use it for anything the page saves | `src/lib/platform/native/save-file.ts` |
| Sharing a view | The phone sheet's share panel offers the system share sheet in place of the X, LinkedIn and Reddit links | `components/shell/mobile/share-panel.tsx`, `shareLink()` in `bridge.ts` |
| Android's back button | Closes what is open first, through the same stack as Escape (sheets, windows, dialogs, popovers); then back a page; at the map it puts the app away without ending it | `components/shell/native/app-links.tsx` |
| Launch screen | Native splash (dark, the mark) until the map shell mounts and calls `SplashScreen.hide()`; four seconds at most | `components/shell/native/app-links.tsx` |
| Get the app | `/download` (in ten languages, with a QR code to open it on a phone), "Get the app" in More (never inside an app), the site footer and the sitemap. The links appear only once there is something to get (a file in `latest.json` or a store link, `appsOut()`) | `src/app/download`, `components/site/download` |

## 2. Sign-in through the system browser

1. The app's sign-in button (`SocialButtons`) stores a random state in `sessionStorage` and opens
   `takip.dev/app/sign-in?provider=google&return=<path>&state=<s>`: in an in-app browser on phones
   (`@capacitor/browser`, SFSafariViewController / Custom Tabs, which Google accepts), in the default
   browser on desktop.
2. `/app/sign-in` notes the state in that tab's `sessionStorage` and starts Better Auth's social sign-in
   **from that browser**, so the OAuth state cookie and the callback share one cookie jar. The provider
   returns to `/app/handoff`.
3. `/app/handoff`, now signed in there, shows "Back to the TAKIP app" only in the tab step 2 started.
   The tap mints a one-time token (`GET /api/auth/one-time-token/generate`, Better Auth's `oneTimeToken`
   plugin, hashed, three minutes, single use) and opens `dev.takip.app://auth?ott=…&return=…&state=…`.
   Minting on load would hand the session of anyone signed in who is sent to that page to whichever
   app has claimed the scheme; the tab check and the tap stop that drive-by.
4. The app gets the link (`appUrlOpen` on phones, which also closes the in-app browser; the main
   process on desktop) and loads `/app/verify?…` in its own web view.
5. `/app/verify` refuses a state it didn't start, trades the token for the session
   (`POST /api/auth/one-time-token/verify` sets the session cookie in the app's jar) and returns to
   the path sign-in began on. Failures go to `/?account=sign-in-failed&error=…`, the dialog's own message.

The app and the browser then share one session: signing out in either ends both.

What is left: another app on the same device can register `dev.takip.app` too, and would receive a
token if the person taps through a sign-in they started from a link rather than from TAKIP. Returning
on a verified link instead of the scheme (`https://takip.dev/app/verify`, an Android App Link and an
iOS universal link, §4) closes that, once the association files are served. The plugin also means a
script injected into takip.dev could carry a session elsewhere, which the httpOnly cookie used to stop.

## 3. Versions

`apps/mobile/package.json` and `apps/desktop/package.json` carry the shell versions (x.y.z). `npm run sync`
in `apps/mobile` writes it into the Android `versionName`/`versionCode` and the iOS
`MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` (1.2.3 → 10203). The user agent carries it too: when
`latest.json` (§5) has a newer build for the app's system, the site shows the app a note once per
version, whose button opens /download in the system browser (`appUpdate()` in `updates.ts`,
`components/shell/native/app-update-note.tsx`). The iPhone app has no file there; the App Store updates it. Bump a shell only when it changes; a release is tagged
`apps-v<version>` and both packages must match the tag (CI checks).

## 4. Domain association (takip.dev links open the app)

- Android: the manifest asks to verify `https://takip.dev` for the reading pages and the map (`/`,
  `/map`, `/city/…`, `/event/…`, `/w/…`), never `/api` or `/app`. Verification needs
  `/.well-known/assetlinks.json`, served once `ANDROID_CERT_SHA256` names the signing keys (the upload
  key, and Play's app signing key from Play Console → Setup → App signing).
- iOS: `/.well-known/apple-app-site-association` is served once `APPLE_TEAM_ID` is set; the app then
  needs the Associated Domains capability (`applinks:takip.dev`), which a free Apple ID can't sign.
- Both: `src/lib/platform/native/app-links.ts`.

## 5. Downloads on takip.dev

Direct downloads (APK, `.dmg`, `.exe`, AppImage, `.deb`) live in `DOWNLOADS_DIR` on the server
(`~/takip/data/downloads` on the NUC by default) with a `latest.json` that `/download` reads per
request. `/download/<file>` serves only files named in that manifest. `tools/native/publish.mjs`
fills it: `collect` (local builds, or `--release apps-vX.Y.Z` for CI's draft release) then `push`
(rsync to the NUC). Store links come from `APP_STORE_URL` and `PLAY_STORE_URL`, read at request time.

## 6. CI (`.github/workflows/apps.yml`)

- A push or pull request that touches `apps/mobile/**` builds a debug APK on Linux; one that touches
  `apps/desktop/**` builds the Linux packages. Web changes run nothing here.
- An `apps-v*` tag builds everything signed: the Android APK and Play bundle, the desktop apps on
  macOS, Windows and Linux, and the iPhone app, which uploads to TestFlight. It also drafts a GitHub
  release with the files. Nothing reaches takip.dev or a store until it is published by hand.
- A manual run (Actions → Apps → Run workflow) builds everything without a release.
- Secrets: [`../runbooks/app-stores.md`](../runbooks/app-stores.md) §5.

## 7. The iPhone widget, and CarPlay

CarPlay shows no web content, and an app of its own needs Apple to grant a category (public safety would fit
TAKIP's hazards; roadmap §1.10). What needs no approval is a widget: iOS puts an app's small widget on the CarPlay
dashboard by itself. So the iPhone app carries one, **Near you**, in `ios/App/TAKIPWidget` (WidgetKit, iOS 17+;
small, medium and Lock Screen sizes).

- It reads `/api/near-now?lat=&lon=&lang=&unit=` (`src/app/api/(feeds)/near-now`, ranking in
  `src/lib/feeds/hazards/near-now.ts`): the nearest current warning, the strongest quake within 300 km in the last
  day, a named fire (or a satellite hotspot) nearby, lightning in the last 15 minutes, rain. At most four lines,
  most pressing first, already worded in the phone's language and in km or miles. New wording goes in the web
  catalogs like any other text, so the widget changes with the site.
- Where: the device's last position when the person lets widgets use location (`NSWidgetWantsLocation`), else
  `/api/geo`, which places the connection as the site does. It refreshes every 15 minutes (5 after a failure) and
  keeps the last answer for when the network is down.
- A tap opens that hazard on the map in the app: `dev.takip.app://open?path=…`, which `appLinkPath` turns into a
  page of the site (`handoff.ts`).
- The target was added by `apps/mobile/tools/add-widget.rb` (CocoaPods' xcodeproj library); run it again only if
  `cap add ios` ever recreates the project. `npm run sync` keeps its site URL and version equal to the app's.
- To look at it without a phone, the views can be drawn on a Mac with SwiftUI's ImageRenderer; a real check is
  adding the widget on a simulator or phone (long-press the Home Screen → +), or CarPlay in Xcode's simulator
  (I/O → External Displays → CarPlay).

## 8. The desktop shell

`apps/desktop` (Electron 45, electron-builder 26) is one window around the site (`main.mjs`). Only
the site's origin stays in the window: `window.open` and links elsewhere go to the system browser,
which is how social sign-in leaves. The `dev.takip.app` scheme is registered (the macOS Info.plist,
an NSIS registry entry, the deb's `x-scheme-handler`); `dev.takip.app://auth?…` loads `/app/verify?…`
in the same window, so the sign-in state in sessionStorage survives. When the site can't be reached
or answers 5xx, the window shows a bundled offline page (`tools/make-offline.mjs`). Geolocation, the
microphone, the clipboard and notifications are granted to the site's origin only. The window keeps
its bounds in `userData/window.json`.

- Builds: `.dmg` for Apple silicon and for Intel (about 120 MB each; a universal one was twice that), NSIS `.exe` (x64), AppImage and `.deb` (x64), all from a Mac.
  Unsigned by default; macOS is ad-hoc signed so Apple silicon doesn't call the download "damaged".
  `CSC_LINK`/`CSC_KEY_PASSWORD` sign; `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` notarize.
- `npm run smoke -- out.png` loads the site offscreen and prints the URL, user agent and whether the
  ad script and the map loaded, so it works with the screen locked.
- Not working yet: the browser's own geolocation on Windows and Linux (Chromium needs a Google key
  there; the site falls back to IP placement); an AppImage registers the scheme only once integrated
  (AppImageLauncher); the menu is English.

## 9. Working on the shells

```bash
cd apps/mobile
npm ci                                   # own lockfile: the shells are not root workspaces, so deploys never install them
npm run sync                             # offline page + versions, then cap sync
npm run android:debug                    # APK in android/app/build/outputs/apk/debug (JDK 21, ANDROID_HOME)
TAKIP_APP_URL=http://localhost:3000 npm run sync   # a dev build against this laptop; adb reverse tcp:3000 tcp:3000
npm run ios:build                        # Xcode 26 or later (27.1 here): an unsigned simulator build
npm run ios:open                         # run on a simulator or a phone from Xcode
npm run assets                           # icons, launch screens and store graphics from public/brand

cd apps/desktop
npm ci --workspaces=false
TAKIP_APP_URL=http://localhost:3000 npm start
npm run dist:mac                         # or dist:win, dist:linux, dist; files in apps/desktop/dist
```

After a dev build, run `npm run sync` again without `TAKIP_APP_URL`, or the next build loads the laptop.
With `TAKIP_APP_URL` on http, the Android web view is debuggable from `chrome://inspect`.
