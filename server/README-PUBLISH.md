## Publish

The demo publish endpoint is intentionally simple.

Start:

OTA_ADMIN_TOKEN=my-secret npm start

Then:

OTA_SERVER=http://localhost:4500 \
OTA_ADMIN_TOKEN=my-secret \
node ../ota/publish-ota.js android 1.0.1

The server writes:

releases/
  android/
    1.0.1/
      update.zip
      manifest.json

and changes:

releases/versions.json

Do not expose this publish endpoint publicly without authentication,
HTTPS, rate limiting and proper authorization.
