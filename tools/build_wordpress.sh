#!/bin/sh
# Build the WordPress plugin: copy core, the article script and the data it needs
# into wordpress/means2me/vendor/, then zip it to dist/means2me.zip for
# "Plugins → Installieren → Plugin hochladen". Run again after every data update.
set -e
cd "$(dirname "$0")/.."
P=wordpress/means2me
rm -rf "$P/vendor"
mkdir -p "$P/vendor/core" "$P/vendor/embed" "$P/vendor/Daten/listen" dist
cp core/*.js "$P/vendor/core/"
cp embed/means2me.js "$P/vendor/embed/"
cp Daten/exchange_rates.json Daten/indices.json Daten/index_values.json Daten/LICENSE.md "$P/vendor/Daten/"
cp Daten/listen/*.json "$P/vendor/Daten/listen/"
cp LICENSE "$P/LICENSE"
rm -f dist/means2me.zip
(cd wordpress && zip -qr ../dist/means2me.zip means2me)
echo "dist/means2me.zip $(du -h dist/means2me.zip | cut -f1)"
