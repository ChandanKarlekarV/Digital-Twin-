# VARUNA-AI · KG-D6 Digital Twin

A browser-based holographic digital twin of the Reliance KG-D6 deepwater gas block
(Krishna-Godavari basin, Bay of Bengal), with a voice assistant and hand-gesture control.

## Run it

```bash
npm install      # also copies the offline MediaPipe hand-tracking model into public/
npm run dev      # http://localhost:1420
npm run build    # production build in dist/ (deployed by Vercel)
npm test         # voice, gestures, physics, leak detection and integration suites
```

Windows shortcuts: `install-and-run.bat` / `install-and-run.ps1`, or `npm start` to serve the built app locally.

## What is real and what is modelled

| Data | Source |
|---|---|
| Gas and oil + condensate production | Reliance quarterly results (latest: Q2 FY27, 24.0 MMSCMD, 15,903 bbl/d) — `src/data/kgd6Production.ts` |
| Wind, waves, currents, sea temperature, tide | Open-Meteo, live |
| USD/INR (ledger values) | European Central Bank reference rates, live and historical |
| Earthquakes within 1,000 km | USGS, live |
| Pressures, temperatures, per-asset flows | Computed by the physics model from the published rate (plant sensor data is not public) |

Values that are design assumptions (pipe sizes, gas composition, meter accuracy, equipment
ratings) are labelled `ASSUMPTION` in the code and tagged **design** in the UI.

## Physics (`src/physics`)

- 200 Hz fixed-step simulation, records stored at 50 Hz (`TelemetryEmitter.ts`).
- Network model (`KgD6FlowModel.ts`): real-gas density (Papay Z, Sutton), pipe friction,
  riser gas column, well deliverability, parallel-riser flow split, flowline cooling,
  Gregory-Scott slugging, drill-string torque / ROP / stick-slip.
- Flow computer (`MeterComputer.ts`): Coriolis density → water cut → ASTM D1250 base
  density and API, with Kalman filtering.
- Leak detection (`src/services/LeakDetector.ts`): compensated mass balance (API RP 1130)
  between the subsea manifold and topside meters, CUSUM alarm, riser location.

## Interaction

- **Voice:** say “Varuna”, then a command (“exploded view”, “open crane two”) or a question
  about the rig (“what is the manifold pressure?”, “is there a leak?”, “what is the tide?”).
- **Gestures:** open palm rotates, two hands zoom, thumb up/down changes layer,
  1–5 fingers select a part and a fist opens it, two fists toggle the exploded view.
- **Incident drills:** blockage, hydrate, riser leak, liquid surge, drill damage / stuck pipe,
  weather squall — each phase driven by the physics.

## Project layout

```
src/data         published production data
src/physics      flow network, metering, drilling, tide engine
src/services     leak detector, live feeds, weather, settlement, AI rules
src/voice        wake word, command parser, rig Q&A, speech
src/vision       MediaPipe hand-gesture engine
src/components   3D scene (canvas/) and HUD panels (hud/)
scripts          model baking (convert-rig-model, rig-pack) and MediaPipe copy
docs             project deck (VARUNA-AI_KG-D6_Deck.pptx)
```

## Limits

This is a twin driven by published data, not a plant system. Connecting it to a real
platform needs read-only access to the operator's historian or SCADA (OPC-UA / Modbus),
the real line geometry and meter specifications, calibration against field history, and
validation before any operational use. It is advisory only and never a safety system.
