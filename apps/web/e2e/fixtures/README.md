# End-to-end fixtures

`test-basemap.pmtiles` is a tiny synthetic basemap (360 tiles around Valencia, zoom 0 to 15: land, sea, a road grid, one place label, a hospital and, at zoom 15 only, a pharmacy) in the Protomaps layer schema. It lets the end-to-end tests render a real map without network access to any tile server.

It was generated with `make-test-basemap.py`:

```sh
pip install pmtiles mapbox-vector-tile shapely
python3 make-test-basemap.py test-basemap.pmtiles
```
