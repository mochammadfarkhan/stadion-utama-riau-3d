# Desain: Panel Settings (gaya Tidewater) — production grade

Referensi pola: dgreenheck/tidewater (MIT) — vanilla DOM, tanpa framework. Atribusi dicantumkan di README.

## Tujuan
Panel pengaturan kaca gelap di kanan layar dengan tab ikon (Langit, Cuaca, Grafik, Kamera, Audio, Performa), section collapsible, slider custom dengan label + nilai, toggle switch, select segmented, widget busur matahari (time of day) dengan slider gradien, tombol header (screenshot, bantuan, collapse), rail ikon saat panel tertutup, hotkey (H panel, F1 bantuan, P photo mode, Esc tutup). Semua nilai hidup di `src/settings/store.js` (sudah ada), persist ke localStorage, reset per kontrol/section/global.

## Arsitektur & kontrak
```
src/settings/schema.js, store.js         (ADA) sumber kebenaran: key "grup.field"
src/ui/dom.js                            h(), esc(), uid(), clamp(), isTypingTarget(), callHook()
src/ui/icons.js                          icon(name, cls) → string SVG inline (stroke currentColor)
src/ui/theme.css, panel.css, controls.css, time-of-day.css
src/ui/controls/Control.js               base: {panel, store, key, field} → el; update() baca store; setValue → store.set
src/ui/controls/Slider.js | Toggle.js | Select.js | Button.js | Info.js | Presets.js | TimeOfDay.js
src/ui/Container.js                      Container (addSlider/addToggle/addSelect/addButton/addInfo/addPresets/addTimeOfDay/addFolder), Folder, Tab
src/ui/Panel.js                          SettingsPanel({ root, store, hooks }) → addTab, selectTab, togglePanel, setPhotoMode, toast, refresh, resetAll, isPointerOverUI, dispose
src/ui/buildPanel.js                     membangun tab/section/kontrol DARI SETTINGS_SCHEMA secara otomatis (widget khusus: 'sunArc' → TimeOfDay), plus tab Performa dengan Info live
src/ui/bindings/*.js                     store → scene: bindSky, bindWeather, bindGraphics, bindCamera, bindAudio, bindPerformance; tiap fungsi (store, ctx) → unsubscribe()
src/ui/Screenshot.js                     captureScreenshot(app) → unduh PNG (render ulang 1 frame lalu toBlob)
```

### Kontrak kontrol
- Konstruktor: `new Slider(container, { key, field, label?, tooltip?, onFinishChange? })` — `field` dari `store.field(key)`; nilai dibaca `store.get(key)`, ditulis `store.set(key, v)`; kontrol `store.subscribe(key, …)` untuk repaint; `dispose()` melepas langganan.
- `isModified()` = nilai ≠ `field.default`; reset → `store.set(key, field.default)`.
- Info: `{ label, get: () => string }` di-refresh tiap 250 ms oleh panel.
- TimeOfDay: key jam (0–24); dial SVG + track gradien; drag/keyboard/klik-ketik; menampilkan fase (Subuh/Pagi/Siang/Sore/Magrib/Malam) dan jam HH:MM.

### Integrasi scene (bindings)
- sky.hour ↔ `time.setHour` (dua arah: saat `advanceTime`, TimeOfDay menulis balik `store.set('sky.hour', time.hour)` tiap 250 ms tanpa memicu loop: binding mengabaikan set bila |Δ| < 1/120 jam).
- sky.azimuthOffset → rotasi arah matahari (Lighting/TimeOfDay).
- sky.cloudCover/haze → Sky uniforms; sky.exposure → App exposure; sky.fogDistance → fog far.
- weather.raining/intensity/wetness/wind/sound → Weather API.
- graphics.shadowQuality → mapSize 0/1024/2048/4096 (onFinishChange, dispose shadow map); pixelRatio → App; ao/vignette → App; crowdDensity → Crowd.
- camera.mode/fov/sensitivity/followSmoothing → CameraRig & camera.
- audio.* → Bicycle bell gain, Weather rain gain, master.
- performance.showStats/minimap/labels → HUD/App/VendorGroup.
- Hotkey lama N/T/R/O tetap bekerja tetapi menulis ke store (satu sumber kebenaran).

### Isolasi input
Panel `stopPropagation` pointer/wheel/nav-key; buka panel → `exitPointerLock`; klik kanvas diabaikan jika `panel.isPointerOverUI`; hotkey diabaikan saat mengetik; panel tertutup `inert`.

### Aksesibilitas & kualitas
role tab/tabpanel/slider/switch/radiogroup, aria-value*, roving tabindex, focus-visible, AbortController untuk listener, dispose lengkap, tanpa innerHTML dari data pengguna (hanya template statis + esc()), file ≤400 baris, fungsi ≤50 baris.

## Testing
Unit: store (ada), `ui/controls/TimeOfDay.math.js` (todPoint/todHours/phase/clock) dan `buildPanel` (hitung kontrol dari skema) di Node dengan jsdom (`@vitest-environment jsdom`, tambah devDependency jsdom). Smoke: halaman dev, buka panel (H), ubah jam & hujan, reload → nilai bertahan.
