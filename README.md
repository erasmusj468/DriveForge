# DriveForge Vehicle Studio

This build fixes the broken vehicle images on deployments where the `/assets` folder was not uploaded.

## Important
The car photos are embedded directly into `app.js`, so the garage cards and main viewer work even when only the root files are uploaded to Vercel.

The `assets/` JPEGs are also included as source assets for future edits.

## Deploy
Replace the existing DriveForge files with the contents of this folder in the `erasmusj468/DriveForge` repository. Vercel can then redeploy the same project.

No extra asset server or image path configuration is required for the current image system.
