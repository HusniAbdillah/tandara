# Street map and local situation layers

Posko uses MapLibre with OpenStreetMap raster tiles for roads, rivers, buildings
and place labels. Report clusters, reviewed plan points, region boundaries and
coverage counts remain independent local layers. A street map does not establish
flood conditions, safe access or an evacuation route.

`apps/coordinator-web/public/basemap.json` is public runtime configuration, served
at `/basemap.json`. It contains the enabled flag, tile URL templates, attribution
label/link and maximum zoom. It needs no API key for the default OSM service.
Compose mounts that file read-only into Caddy, so operators can edit the host
configuration and reload the map without rebuilding JavaScript. Another
provider also requires its exact host in Posko's `connect-src`/`img-src` CSP and
appropriate attribution/terms. Self-hosted tiles can use a same-origin URL.
Invalid or unavailable configuration falls back to local schematic layers.

The default requests only viewport tiles directly from
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, using normal browser identification
and caching. Attribution is visible, and Posko sends an origin-only referrer.
Warga retains its stricter no-referrer policy. No private report text, contact,
session cookie or receipt token is added to provider requests. The provider sees
network information and the tile coordinates for the viewed area. Disable
"Peta dasar" to hide the basemap; deployment owners can disable the provider in
runtime configuration entirely.

Tile failures show a distinct warning while local layers and text alternatives
remain usable. There is no tile download-for-offline feature, background sweep,
geocoding request or promised tile availability. OSM's public service has limited
capacity and no SLA; an operational deployment must select a suitable provider or
host tiles itself. See the official
[OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

Automated browser tests intercept tile requests with explicit fixture images,
verify attribution, headers, visibility changes, and failed tiles/configuration.
They do not repeatedly exercise the public service. Real street rendering is
checked separately in a visible browser using a single region viewport.
