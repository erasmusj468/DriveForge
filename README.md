# DriveForge Vehicle Studio — Rebuild

A from-scratch vanilla HTML/CSS/JavaScript + Three.js configurator.

## Run locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Generate catalog

```bash
python tools/generate_catalog.py
```

The project intentionally avoids remote GLB dependencies for the main vehicle visuals. Each catalog model maps to a different original procedural 3D reference body profile, so selecting a model visibly changes the vehicle and cannot get stuck on a single default GLB.

Real-world model names/specification profiles are used for reference. The 3D geometry is original and is not an OEM manufacturer asset.
