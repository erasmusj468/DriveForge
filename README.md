# DriveForge Vehicle Studio

A browser-based automotive configurator using HTML/CSS/JavaScript, Three.js/WebGL, GLB vehicle assets, and Python-generated catalog data.

## Run

Serve this directory from a local web server (GLB loading uses browser modules and fetches models from a CORS-enabled CDN):

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Included

- Production-style vehicle chooser: sedan, coupe, hatchback, wagon, SUVs, roadster and supercar.
- Interactive 3D GLB models with orbit, zoom and camera presets.
- Live paint / glass / rubber / interior material changes.
- Wheels, brakes, ride height, track width, aero and body-kit overlays.
- Engine, drivetrain and transmission selector with formula-based performance estimates.
- Build-from-scratch mode that modifies body proportions around real 3D vehicle geometry.
- Save-build JSON export.
- Fictional $20 Pro Garage demo unlock; no real payment processing.

## Asset licensing

Vehicle models are sourced from the Road Car Showroom Lineup on 3DAssets.dev. The pack is described by its publisher as original, manufacturer-neutral vehicle silhouettes released under CC0 1.0 and usable directly with Three.js GLTFLoader. The app only uses the remote CDN URLs in `data.json`; it does not claim affiliation with any automaker.
