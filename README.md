# Rush Fingal

A responsive static guide to Rush, North County Dublin, with a photo carousel, local weather ticker, interactive pub and interest maps, live AIS vessel map, and local activity links.

## Run locally

Serve this directory from a local web server (for example, run `python -m http.server 8000` here and open `http://localhost:8000`). The ArcGIS SDK loads as JavaScript modules, so opening the page directly as a `file://` URL will not load the maps.

## GitHub Pages

The repository includes a GitHub Actions Pages workflow at `.github/workflows/pages.yml`. It publishes the static site files from the repository root on pushes to `main` and on manual workflow dispatch. In repository **Settings → Pages**, select **GitHub Actions** as the build and deployment source. Once a deployment succeeds, GitHub displays the public site URL on that Pages settings screen and in the workflow deployment environment. Publishing the site requires the repository to be public unless its GitHub plan supports private-repository Pages.

The rolling weather banner and forecast card are fixed to Rush (53.5228, -6.1043) and use the public [Open-Meteo forecast API](https://open-meteo.com/en/docs); there is no geolocation fallback or weather from another place. The page reports an unavailable forecast if the service cannot be reached. The banner can be paused and stops moving when reduced motion is requested.

The maps use the [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/) with OpenStreetMap tiles and public [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) data; no API key is required. Use the map tabs to switch between pubs and places of interest. If live Overpass lookups are unavailable, the map shows saved Rush locations and a status notice; use the retry button to try again. Pub photos are shown only when a pub's OpenStreetMap record links to a Commons file with a verified reusable license.

The separate live AIS map connects to the anonymous, read-only [Open Waters AIS v1 WebSocket API](https://openwaters.io/api/ais/), which documents a browser WebSocket example and does not require a token for small-area subscriptions. Its bounding box covers Rush and extends approximately 5 nautical miles offshore. A personal token is not needed or used; never place a token or private key in this static page. If the site later switches to the authenticated compatibility `/v0/stream`, it must do so through a server-side proxy with the token stored in a server environment variable, never in client code. The map plots only positions actually received; it may be empty if there is no coverage or recent traffic. AIS coverage is uneven, the service is best effort, and positions are not suitable for navigation. Popups preserve the source, license, and attribution supplied for each report; the aggregate is not under a single blanket license.

The original Rush photographs are hosted on Wikimedia Commons; each image's file page links to its author and license:

- [Aerial view of Rush](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Rush.jpg) - Treehill, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [Breakwater](https://commons.wikimedia.org/wiki/File:Breakwater_-_geograph.org.uk_-_493424.jpg) - Mark Duncan / Geograph Britain and Ireland, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)
- [A glimpse of the Martello Tower](https://commons.wikimedia.org/wiki/File:A_glimpse_of_the_Martello_Tower_-_geograph.org.uk_-_6406240.jpg) - Eirian Evans / Geograph Britain and Ireland, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)
- [Drying off after a dip at Rush](https://commons.wikimedia.org/wiki/File:Drying_off_after_a_dip_at_Rush_-_geograph.org.uk_-_6406237.jpg) - Eirian Evans / Geograph Britain and Ireland, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)

The carousel also loads 50 additional geotagged images around Rush and Fingal from the [Wikimedia Commons API](https://commons.wikimedia.org/w/api.php). It accepts CC0, Creative Commons Attribution, Creative Commons Attribution-ShareAlike, and public-domain files; each slide links to its Commons file page and displays the author and license. Images with vehicle/traffic-related file descriptions or titles are excluded; the selected set has been visually checked to remove identifiable cars and vans. Images are loaded as the carousel advances. The gallery may contain fewer than 54 photos if Commons or the network is unavailable.

The activities section links to [current Fingal events](https://www.fingal.ie/events) and evergreen nearby activities. Check the linked venues for current opening times and schedules; event dates are not hard-coded.

The header's yew-tree mark is original decorative artwork created for this page; it is not an official Rush or Fingal coat of arms.

## Recreating this site

The chronological feature prompts and a consolidated implementation prompt are in [`REMAKE-PROMPTS.md`](REMAKE-PROMPTS.md). They document the requested experience without including private keys, hidden instructions, or deployment credentials.

## Files

- `index.html` - page content and semantic structure
- `styles.css` - responsive layout and styling
- `script.js` - carousel, Rush weather, Overpass maps, and AIS stream integration
- `REMAKE-PROMPTS.md` - chronological requirements and a reusable site recreation prompt
- `.github/workflows/pages.yml` - GitHub Pages deployment workflow
