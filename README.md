# DriveForge — Vehicle Studio

A high-end browser car configurator prototype built with HTML, CSS, JavaScript, Three.js/WebGL and a Python catalog generator.

## Real-world garage
The Vehicle tab now includes 24 real-world reference profiles from BMW, Dodge, Ford, Toyota, Porsche, Chevrolet, Nissan, Mercedes-AMG, Audi, Lexus, McLaren, Aston Martin, Lamborghini, Ferrari, Honda and Subaru.

The 3D viewer intentionally uses original, manufacturer-neutral reference geometry rather than shipping OEM logos or manufacturer-owned meshes/textures. The real model names/spec profiles are there to make the experience feel like a production-car configurator while keeping the 3D asset layer independent.

## Run
Serve the folder with any static web server. Opening `index.html` directly also works because the catalog is embedded inline.

## Files
- `index.html` — application shell and embedded fallback catalog
- `styles.css` — showroom and configurator UI
- `app.js` — Three.js/WebGL scene, controls, model loading, customization and formulas
- `data.json` — generated catalog data
- `tools/generate_catalog.py` — catalog generator
- `favicon.svg` — icon

## Reference sources
Current model facts were cross-checked against manufacturer sites where available:
- BMW M models: https://www.bmwusa.com/vehicles/bmw-m/models.html
- BMW i5 M60: https://www.bmwusa.com/vehicles/m-series/bmw-i5-m60/bmw-i5-m60xdrive-overview.html
- Dodge Charger 2026: https://www.dodge.com/2026/charger.html
- Dodge Charger performance: https://www.dodge.com/charger/performance.html
- Ford Mustang GT 2026: https://www.ford.com/cars/mustang/models/gt-fastback/
- Toyota GR Supra 2026: https://www.toyota.com/grsupra/features/
- Porsche 911 Carrera: https://www.porsche.com/usa/models/911/carrera-models/911-carrera/
- Porsche 911 Turbo S: https://newsroom.porsche.com/en/press-kits/pfv-porsche-911-turbo-s/Powertrain.html
- Chevrolet Corvette Stingray: https://www.chevrolet.com/performance/previous-year/corvette/stingray
- Chevrolet Corvette ZR1X: https://news.chevrolet.com/newsroom.detail.html/Pages/news/us/en/2025/jun/0617-2026-Corvette-ZR1X-hypercar.html
- Nissan GT-R: https://www.nissanusa.com/vehicles/sports-cars/gt-r.html
