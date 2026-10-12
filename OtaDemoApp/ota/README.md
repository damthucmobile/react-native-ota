Copy this folder into the root of your React Native project.

Expected root:

my-app/
  android/
  ios/
  index.js
  package.json
  ota/
    build-ota.js
    package-ota.js
    publish-ota.js

Build:

node ota/build-ota.js android 1.0.1
node ota/package-ota.js android 1.0.1
node ota/publish-ota.js android 1.0.1

The publish script needs:

OTA_SERVER=http://localhost:4500 node ota/publish-ota.js android 1.0.1

For a LAN phone test:

OTA_SERVER=http://192.168.1.10:4500 node ota/publish-ota.js android 1.0.1
