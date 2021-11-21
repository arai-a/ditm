# DITM: Developer In The Middle

An extension to modify the web server's response in place,
for debugging possibly-not-your-own website.

## Installation

  1. Install DITM from Firefox Add-ons: https://addons.mozilla.org/en-US/firefox/addon/ditm/

## Usage

### Replace the response text

  1. Open the web page
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Select the resource that you want to modify the response, by either:
     - Select from "Used" resource list
     - Type URL, and hit "Reload from URL" or Enter to load the content
  1. modify the content shown in the text area
  1. Hit "Save" (✓) button
  1. Reload the web page

### Replace the response with another remote file

  1. Open the web page
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Select the resource that you want to replace the response, by either:
     - Select from "Used" resource list
     - Type URL, and hit "Reload from URL" or Enter to load the content
  1. Select "URL" tab
  1. Enter the URL that returns the replacement body
  1. Hit "Save" (✓) button
  1. Reload the web page

### Replace the response with local file

Unfortunately DITM cannot read local file, but you can run local web server and
use the response.

The simple way is to use Python 3's `http.server` module.

```
$ cd {DIRECTORY_THAT_CONTAINS_THE_FILE}
$ python3 -m http.server 8000
```

And use `http://localhost:8000/{FILENAME}`.

### Replicate all used files in local directory and replace the all responses with them

Apply "replace the response with local file" for all files used in the page, with the following steps:

  1. Open the web page
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Select "Replicate" tab
  1. Hit "Download script and start mapping URLs" button
  1. Save `ditm-replicate.py` in temporary directory
  1. Run `python3 ditm-replicate.py` to extract the files, and run the local server
  1. Reload the web page

### Load previously saved replicate

  1. Run `python3 ditm-replicate.py` to extract the files, and run the local server
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Drag and drop `ditm-replicate/ditm-replicate.json` file into DITM pane

### Show log for replacement

  1. Open the web page
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Select "Log" tab

## About imported files

The following files are imported from https://hg.mozilla.org/mozilla-central/
  * [`pretty-print-worker.js`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/dist/pretty-print-worker.js)
  * [`devtools-common.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/common.css)
  * [`devtools-splitters.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/splitters.css)
  * [`devtools-variables.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/variables.css)
  * [`devtools-toolbars.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/toolbars.css)
  * [`devtools-tooltips.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/tooltips.css)
  * [`debugger-variables.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/src/components/variables.css)
  * [`debugger-Tabs.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/src/components/Editor/Tabs.css)
  * [`debugger-App.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/src/components/App.css)
  * [`devtools-theme.css`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/themes/light-theme.css) (partially)
  * [`prettyPrint-dark.svg`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/images/prettyPrint.svg)
  * [`prettyPrint-light.svg`](https://hg.mozilla.org/mozilla-central/raw-file/tip/devtools/client/debugger/images/prettyPrint.svg)

The following icons are imported from [Photon Icons](https://design.firefox.com/icons/viewer/)

  * `check-dark.svg`
  * `check-light.svg`
  * `clear-dark.svg`
  * `clear-light.svg`
  * `more-dark.svg`
  * `more-light.svg`
  * `refresh-dark.svg`
  * `refresh-light.svg`
