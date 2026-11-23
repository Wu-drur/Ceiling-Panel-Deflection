# Interactive Deflection Comparison of Ceiling Panel Materials

An Imperial College London Materials Selection coursework demonstration built with React, Three.js and Vite.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
npm test
npm run dev
```

Open the URL printed by Vite. The initial view is unloaded at ×200. **Apply Load** ramps to the selected pressure. **Remove Load** ramps back to zero. **Play** replays the load ramp or resumes a paused animation. Drag or zoom any model to move all cameras together.

## Model and inputs

Three 600 × 600 mm panels rest on four simply supported edges, represented by a simplified T24 grid. The linear elastic model uses a uniform transverse pressure of 0–0.30 kPa and Poisson's ratio ν = 0.30. The deflection limit is 1.2 mm. Values are preliminary coursework estimates.

| Material | E (GPa) | Substrate thickness (mm) | Max at 0.15 kPa (mm) | Max at 0.30 kPa (mm) |
| --- | ---: | ---: | ---: | ---: |
| Engineered Bamboo + TIFC | 17 | 6 | 0.235 | 0.469 |
| Plywood + Natural Wood Veneer | 6 | 6 | 0.665 | 1.330 |
| Paper/Cardboard + Natural Wood Veneer | 2.7 | 7 | 0.931 | 1.861 |

D = Et³/[12(1 − ν²)] and δmax = 0.00406 qL⁴/D. The code multiplies GPa by 10⁹ and kPa by 10³ to obtain Pa, divides mm by 10³ to obtain m, and multiplies the resulting deflection in m by 10³ to display mm.

The surface uses the Navier double-sine series for four-edge simple supports and uniform load. For normalized in-plane coordinates u and v, each odd m, n contributes sin(mπu)sin(nπv) / [mn(m²+n²)²]. The implementation sums the first 16 odd indices per direction and divides by the centre sum so that the peak matches the specified rounded coefficient. Three.js displays downward displacement with a common amplification factor and a tint referenced to 1.2 mm. Material textures and support profiles are illustrative.

This is preliminary isotropic thin-plate bending analysis. The project does not include FEA, fire testing, or product certification.

## Deploy via GitHub Pages

1. Create or select a repository under the intended GitHub account. For standard GitHub Pages, use a public repository.
2. From the extracted project directory, run the commands below. Replace OWNER and REPOSITORY with the actual repository path. If using an existing repository, clone it first and commit these files there.
3. In the repository, go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Run the **Deploy to GitHub Pages** workflow from **Actions** if the initial run occurred before Pages was configured. The deployment job and **Settings → Pages** show the verified Live Demo URL.

```sh
git init -b main
git add .
git commit -m "Build ceiling panel deflection simulator"
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

The included workflow sets the source link to the actual GitHub repository. Vercel or Netlify can also import the repository. Use build command `npm run build`, publish directory `dist`, and set `VITE_SOURCE_URL` to the GitHub repository URL. Without it the footer downloads the packaged source on the hosted preview.
