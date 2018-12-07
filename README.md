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
    - Type URL, and hit "Load" or Enter to load the content
  1. modify the content shown in the text area
  1. Hit "Save" button
  1. Reload the web page

### Replace the response with another remote file

  1. Open the web page
  1. Open Developer Tools
  1. Choose "DITM" tab in the Developer Tools
  1. Select the resource that you want to replace the response, by either:
    - Select from "Used" resource list
    - Type URL, and hit "Load" or Enter to load the content
  1. Select "URL" radio button
  1. Enter the URL that returns the replacement body
  1. Hit "Save" button
  1. Reload the web page

### Replace the response with local file

Unfortunately DITM cannot read local file, but you can run local web server and
use the reponse.

The simple way is to use Python's SimpleHTTPServer module.

```
$ cd {DIRECTORY_THAT_CONTAINS_THE_FILE}
$ python -m SimpleHTTPServer 8000
```

And use `http://localhost:8000/{FILENAME}`.
