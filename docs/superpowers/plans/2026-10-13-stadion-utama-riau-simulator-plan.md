# Rencana Implementasi — Simulator Stadion Utama Riau

Eksekusi dengan swarm agent paralel. Setiap task mandiri, mengikuti kontrak di spec §3.

## Fase 0 — Scaffold (selesai)
Vite + three@0.186.1 + vitest, `config/constants.js`, `core/Input.js`, repo GitHub.

## Fase 1 — Paralel (5 agen)
| # | Agen | Deliverable | Verifikasi |
|---|---|---|---|
| 1 | sim | `src/sim/{ellipse,trackPath,bikePhysics,runnerSim,footballAI,vendorSim}.js` + `tests/*.test.js` (TDD) | `npm test` hijau |
| 2 | stadium-exterior | `src/world/stadium/{Shell,Facade}.js`, `src/world/props/{Signage,Flagpole,GuardPost,Fence}.js` | import di node tanpa error |
| 3 | stadium-interior | `src/world/stadium/{Tribune,Pitch,Track,Fixtures}.js` | sama |
| 4 | site | `src/world/{Ground,Landscape}.js`, `src/world/props/{Bench,TrashBin,LampPost,Planter,Monument,Gapura,Vehicles,Cart}.js` | sama |
| 5 | entities | `src/entities/{Humanoid,Bicycle,Runner,Footballer,Vendor,Crowd}.js` | sama |

### Kontrak sim/* (ditetapkan sekarang agar agen paralel)
- `ellipse.js`: `ellipsePerimeter(a, b)`, `ellipsePointAtArc(a, b, s) → {x, z, theta}` (s = jarak busur), `ellipseTable(a, b, n)`.
- `trackPath.js`: `laneRadius(lane)`, `laneLength(lane)`, `createLanePath(lane) → THREE.CurvePath` (2D x→x, y→z), `pointOnLane(lane, distMeters) → {x, z, yaw}` (yaw = rotasi Y agar model menghadap +Z lokal searah tangent, lari berlawanan arah jarum jam dilihat dari atas).
- `bikePhysics.js`: `createBikeState({x,z,yaw})`, `stepBike(state, {pedal:-1..1, steer:-1..1, sprint:boolean}, dt, cfg=BIKE) → state` dengan field `{x, z, yaw, v, steer, lean, wheelSpin, pedalAngle}`.
- `runnerSim.js`: `createRunner({lane, speed, dist, id})`, `stepRunner(r, dt) → r` (dist wrap modulo laneLength).
- `footballAI.js`: `createMatch({teamSize=5}) → {players[], ball, score:{a,b}, t}`, `stepMatch(match, dt) → match`. player `{id, team:'a'|'b', pos:{x,z}, vel:{x,z}, state:'CHASE'|'KICK'|'RETURN', home:{x,z}, facing, kickTimer}`; ball `{pos:{x,y,z}, vel:{x,y,z}}`. Hanya pemain terdekat per tim yang CHASE; gol (|z| > PITCH.length/2 dan |x| < goalWidth/2) → skor + reset.
- `vendorSim.js`: `VENDOR_CATALOG = {minuman:[{id,name,price}], buah:[...]}`, `createVendor({id, kind, waypoints[], speed})`, `stepVendor(v, dt) → v` (bergerak antar waypoint, berhenti beberapa detik), `createWallet(balance=50000)`, `buy(wallet, kind, itemId) → {ok, wallet, item?, error?}` (wallet `{balance, items[]}`).

## Fase 2 — Integrasi
`core/App.js`, `core/CameraRig.js`, `world/Lighting.js`, `ui/HUD.js`, `ui/hud.css`, `main.js`, collider sederhana, GitHub Actions deploy. Dev server, screenshot, perbaiki.

## Fase 3 — Review & polish
code-reviewer agent, perbaikan performa, README, push, aktifkan Pages.
