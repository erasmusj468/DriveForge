# DriveForge Vehicle Studio

Professional-style browser car configurator.

## Important selector fix
Real-world reference profiles now prefer their model-specific `url` for the 3D viewer. The previous build incorrectly redirected those profiles to the generic category `visualUrl`, which made multiple selections render the same default car.

The garage cards are native buttons and selecting a model immediately updates the active build and requests that model's own 3D asset. Late model responses are ignored when the user has already selected another car, and the previous car stays visible until the replacement is ready.

## Run
Serve this folder from a local web server (for example `python -m http.server 8000`) and open `index.html` through that server so ES modules and remote GLB assets work consistently.

## Technologies
HTML, CSS, JavaScript, Three.js/WebGL, GLB/glTF assets, and a Python catalog generator.
