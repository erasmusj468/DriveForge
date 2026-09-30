# DriveForge Realistic 3D Car Configurator

A browser-based car configurator using HTML/CSS/JavaScript, Three.js/WebGL and a Python build-time data generator.

## Realism approach
- Real GLB road-car asset from 3DAssets.dev, released as CC0.
- Three.js PBR materials, environment lighting, shadows, reflections and tone mapping.
- Live paint/finish/wheel/stance/aero/light changes.
- Named wheel and door/bonnet animation pivots from the vehicle asset.

## Run
Serve the folder from a web server (for example Vercel, GitHub Pages, or `python -m http.server 8000`).

The model is loaded from the public GLB URL listed in `data.json`, so an internet connection is required for the 3D asset.

## Python
`tools/generate_catalog.py` creates `data.json` from the configuration source. Edit the Python source, run it, and the browser app reads the generated catalog.

## Asset credit
Model: “Mid-engine sports car (Car Park and Road Vehicle Fleet)” from 3DAssets.dev
Asset page: https://3dassets.dev/assets/car-park-and-road-vehicle-fleet-sports-car-900de487
License: CC0
