#!/bin/bash
# Contours IRIS IGN (WFS data.geopf.fr), un département à la fois, pause 2 s.
BRUT="${BRUT:?indiquer le dossier des téléchargements}"
for d in 14 35 37 44 49 50 53 72; do
  out=$BRUT/ign-iris/iris-$d.json
  if [ -s "$out" ] && head -c 40 "$out" | grep -q FeatureCollection; then echo "$d deja la"; continue; fi
  curl -sS -m 180 -w "dep $d HTTP %{http_code} %{size_download} octets\n" -o "$out" \
   "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=STATISTICALUNITS.IRIS:contours_iris&OUTPUTFORMAT=application/json&CQL_FILTER=code_insee%20LIKE%20'$d%25'"
  sleep 2
done
