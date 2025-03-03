let needsContent = true;

let files_resolve;
let files;
let url_history = [];
const files_promise = new Promise(resolve => {
  files_resolve = resolve;
});

function log_error(e) {
  console.error(e);
}

let replicate_page_url = null;
let replicate_list = null;
let replicate_script = null;

const used_selector_box = document.getElementById("used-selector-box");
const source_text_box = document.getElementById("source-text-box");
const source_url_box = document.getElementById("source-url-box");
const source_replicate_box = document.getElementById("source-replicate-box");
const source_log_box = document.getElementById("source-log-box");

const log_box = document.getElementById("log-box");
const log_clear = document.getElementById("log-clear");

log_clear.addEventListener("click", clear_log);

const source_text = document.getElementById("source-text");
source_text.placeholder = `1. Select URL from "Used" list
2. Modify content
3. Hit save \u2713 button
4. Reload the webpage

NOTE: Overriding a single file can also be done with the browser's built-in feature "script override" and "network override".
Consider migrating to them!

https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/network_overrides/index.html`;

const source_url = document.getElementById("source-url");
source_url.addEventListener("keypress", event => {
  if (event.key === "Enter") {
    save().catch(log_error);
  }
});

const source_url_more = document.getElementById("source-url-more");
const source_url_menu_container = document.getElementById("source-url-menu-container");
source_url_more.addEventListener("click", async event => {
  source_url_menu_container.classList.toggle("tooltip-visible");
});
const source_url_history = document.getElementById("source-url-history");
const source_url_clear_history = document.getElementById("source-url-clear-history");
source_url_clear_history.addEventListener("click", async event => {
  source_url_menu_container.classList.remove("tooltip-visible");
  browser.runtime.sendMessage({
    topic: "clear-url-history",
  });
});

const url_field = document.getElementById("url");
url_field.addEventListener("keypress", async event => {
  if (event.key === "Enter") {
    load().catch(log_error);
  }
});

const match_field = document.getElementById("url-match");

const status_fields = [
  document.getElementById("status-text"),
  document.getElementById("status-url"),
];

const replicate_status = document.getElementById("status-replicate");

const source_tabs_text_tab = document.getElementById("source-tabs-text-tab");
const source_tabs_url_tab = document.getElementById("source-tabs-url-tab");
const source_tabs_replicate_tab = document.getElementById("source-tabs-replicate-tab");
const source_tabs_log_tab = document.getElementById("source-tabs-log-tab");

function show(type) {
  function show_box(box, t) {
    box.style.display = type === t ? "" : "none";
  }
  function activate_tab(tab, t) {
    if (type === t) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  }

  show_box(source_text_box, "text");
  show_box(source_url_box, "url");
  show_box(source_replicate_box, "replicate");
  show_box(source_log_box, "log");

  pretty_button.disabled = type !== "text";

  activate_tab(source_tabs_text_tab, "text");
  activate_tab(source_tabs_url_tab, "url");
  activate_tab(source_tabs_replicate_tab, "replicate");
  activate_tab(source_tabs_log_tab, "log");

  if (type === "text" || type === "url") {
    used_selector_box.style.display = "";
  } else {
    used_selector_box.style.display = "none";
  }
}

source_tabs_text_tab.addEventListener("click", () => {
  show("text");
});
source_tabs_url_tab.addEventListener("click", () => {
  show("url");
});
source_tabs_replicate_tab.addEventListener("click", () => {
  show("replicate");
});
source_tabs_log_tab.addEventListener("click", () => {
  show("log");
  log_scroll_to_bottom();
});

window.addEventListener("dragover", event => {
  event.preventDefault();
});

window.addEventListener("drop", function(event) {
  const dt = event.dataTransfer;
  if (dt.files.length === 0) {
    return;
  }

  const file = dt.files[0];
  if (file.name !== "ditm-replicate.json") {
    return;
  }

  file.text().then(text => {
    const data = JSON.parse(text);
    show("replicate");
    load_replicate(data);
  });
});

function load_replicate(data) {
  if (!validate_replicate(data)) {
    replicate_status.textContent = `Faled to load ditm-replicate.json`;
    return;
  }

  replicate_page_url = data.page;
  replicate_list = data.list;

  replicate_status.textContent = `Loaded ${data.page} with ${data.list.length} files`;

  start_replicate();
}

function validate_replicate(data) {
  if (typeof data !== "object") {
    return false;
  }

  if (!("page" in data)) {
    return false;
  }

  if (typeof data.page !== "string") {
    return false;
  }

  if (!("list" in data)) {
    return false;
  }

  if (!Array.isArray(data.list)) {
    return false;
  }

  for (const item of data.list) {
    if (!Array.isArray(item)) {
      return false;
    }

    if (item.length !== 2) {
      return false;
    }

    if (typeof item[0] !== "string") {
      return false;
    }

    if (typeof item[1] !== "string") {
      return false;
    }
  }

  return true;
}

function log_scroll_to_bottom() {
  const items = log_box.getElementsByTagName("div");
  if (items.length === 0) {
    return;
  }
  items[items.length - 1].scrollIntoView();
}

const STATUS_TIMEOUT = 10 * 1000;
let statusTimer = null;
function status(text) {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  for (const status_field of status_fields) {
    status_field.textContent = text;
  }
  setTimeout(() => {
    for (const status_field of status_fields) {
      status_field.textContent = "";
    }
  }, STATUS_TIMEOUT);
}

document.getElementById("save-text").addEventListener("click", () => {
  save().catch(log_error);
});
document.getElementById("save-url").addEventListener("click", () => {
  save().catch(log_error);
});

document.getElementById("load-text").addEventListener("click", () => {
  load().catch(log_error);
});

const remove_button = document.getElementById("remove");
remove_button.addEventListener("click", () => {
  remove().catch(log_error);
});
remove_button.disabled = true;

const pretty_button = document.getElementById("pretty");
pretty_button.addEventListener("click", () => {
  prettifySourceText().catch(log_error);
});

document.getElementById("refresh").addEventListener("click", refresh);

const stored_urls = document.getElementById("stored-urls");
stored_urls.addEventListener("change", () => {
  select_stored().catch(log_error);
});

const used_urls = document.getElementById("used-urls");
used_urls.addEventListener("change", () => {
  select_used().catch(log_error);
});

const replicate_progress = document.getElementById("source-replicate-progress");

const replicate_download = document.getElementById("source-replicate-download");
replicate_download.addEventListener("click", () => {
  download_script().catch(log_error);
});

const replicate_start = document.getElementById("source-replicate-start");
replicate_start.addEventListener("click", start_replicate);

const replicate_stop = document.getElementById("source-replicate-stop");
replicate_stop.addEventListener("click", stop_replicate);

const replicate_port = document.getElementById("source-replicate-port");
const replicate_server = document.getElementById("source-replicate-server");

const auto_prettify_js = document.getElementById("auto-prettify-js");

const command_server = document.getElementById("source-replicate-command-server");
const command_no_server = document.getElementById("source-replicate-command-no-server");

replicate_server.addEventListener("change", () => {
  if (replicate_server.checked) {
    command_server.style.display = "";
    command_no_server.style.display = "none";
  } else {
    command_server.style.display = "none";
    command_no_server.style.display = "";
  }
});

show("text");

async function load() {
  const url = url_field.value;
  status(`Loading...`);
  browser.runtime.sendMessage({
    topic: "load",
    url,
  });
}
async function save() {
  const is_text = source_tabs_text_tab.classList.contains("active");
  const type = is_text ? "text" : "url";
  const content = is_text ? source_text.value : source_url.value;

  if (type === "url" && content.startsWith("file:")) {
    status(`file:/// cannot be used. Please use http(s):// instead`);
    return;
  }

  browser.runtime.sendMessage({
    topic: "save",
    url: url_field.value,
    match: match_field.value,
    type,
    content,
  });
  status(`Saved`);
}
async function remove() {
  const url = url_field.value;
  url_field.value = "";
  match_field.value = "exact";
  source_text.value = "";
  source_url.value = "";
  needsContent = true;
  status(`Removed`);
  remove_button.disabled = true;

  if (stored_urls.value === replicate_page_url) {
    stop_replicate();
  }

  browser.runtime.sendMessage({
    topic: "remove",
    url,
  });
}
async function prettifySourceText() {
  const result = await prettifyText(source_text.value);
  if (result.error) {
    status(result.message);
  } else {
    source_text.value = result.response.code;
  }
}
function prettifyText(text) {
  const result = Promise.withResolvers();

  const worker = new Worker("pretty-print-worker.js");
  worker.onmessage = msg => {
    result.resolve(msg.data.results[0]);
  };
  worker.postMessage({
    id: 1,
    method: "prettyPrint",
    calls: [
      [
        {
          url: "foo",
          indent: "  ",
          sourceText: text,
        }
      ]
    ]
  });

  return result.promise;
}
async function select_stored() {
  try {
    await files_promise;

    const url = stored_urls.value;
    if (url === "---") {
      return;
    }
    used_urls.value = "---";
    url_field.value = url;
    const file = files[stored_urls.value];
    match_field.value = file.match;
    fill_source(url, file);
    remove_button.disabled = false;
  } catch (e) {
    console.log(e.toString());
  }
}
async function select_used() {
  try {
    const url = used_urls.value;
    if (url === "---") {
      return;
    }
    stored_urls.value = "---";
    remove_button.disabled = true;
    url_field.value = url;
    match_field.value = "exact";
    await load();
  } catch (e) {
    console.log(e.toString());
  }
}
function handleEvalError(error) {
  if ("isException" in error && error.isException) {
    status("Exception: " + error.value);
  }
  else if ("isError" in error && error.isError) {
    status("Error: " + error.code);
  }
  else {
    status("Unknown error: " + error);
  }
}
async function refresh() {
  const [urls, error] = await browser.devtools.inspectedWindow.eval(`
(function () {
  const urls = new Set();
  function gatherFromScript(script) {
    const src = script.src;
    if (src) {
      urls.add(src)
    }
  }
  function gatherFromCSSLink(link) {
    const href = link.href;
    const rel = link.rel;
    if (rel === "stylesheet" && href) {
      urls.add(href)
    }
  }
  function gatherFromFrame(frame) {
    const src = frame.src;
    if (src) {
      urls.add(src)
    }
    try {
      const href = frame.contentDocument.location.href;
      if (!urls.has(href)) {
        urls.add(href);
        gatherFromDocument(frame.contentDocument);
      }
    } catch (e) {
    }
  }
  function gatherFromDocument(doc) {
    document.querySelectorAll("script").forEach(gatherFromScript);
    document.querySelectorAll("link").forEach(gatherFromCSSLink);
    document.querySelectorAll("frame").forEach(gatherFromFrame);
    document.querySelectorAll("iframe").forEach(gatherFromFrame);
  }
  urls.add(document.location.href);
  gatherFromDocument(document);

  return [...urls];
})();
`);
  if (error) {
    handleEvalError(error);
    return;
  }

  const valid_urls = urls.filter(url => url.startsWith("http"));

  fillUsedList(valid_urls);
}

function initList(list, defaultText) {
  while (list.firstChild) {
    list.firstChild.remove();
  }

  const option = document.createElement("option");
  option.value = "---";
  option.textContent = defaultText;
  list.appendChild(option);
}

function filLDataList(list, items) {
  while (list.firstChild) {
    list.firstChild.remove();
  }

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item;
    list.appendChild(option);
  }
}

function fill_source(url, file) {
  switch (file.type) {
    case "text":
      source_text.value = file.content;
      source_url.value = "";
      show("text");
      break;
    case "url":
      source_text.value = "";
      source_url.value = file.content;
      show("url");
      break;
    case "replicate":
      source_text.value = "";
      source_url.value = "";
      replicate_page_url = url;
      replicate_list = file.content;
      replicate_start.disabled = true;
      replicate_stop.disabled = false;
      show("replicate");
      break;
  }
}

function isReplicate() {
  return source_tabs_replicate_tab.classList.contains("active");
}

async function fillStoredList() {
  let defaultText;
  if (Object.keys(files).length > 0) {
    defaultText = "--- Select URL to load ---";
  } else {
    defaultText = "--- Nothing is saved ---";
  }
  initList(stored_urls, defaultText);

  const isReplicate_ = isReplicate();

  let selected = false;

  for (const url of Object.keys(files).sort()) {
    const file = files[url];

    const option = document.createElement("option");
    option.value = url;
    let label = url;
    if (file.match === "forward") {
      label += "  (forward match)";
    } else if (file.match === "wildcard") {
      label += "  (wildcard)";
    } else if (file.type === "text") {
      label += `  (text)`;
    } else if (file.type === "url") {
      label += `  (url)`;
    } else if (file.type === "replicate") {
      label += `  (replicate with ${file.content.length} files)`;
    }
    option.textContent = label;

    stored_urls.appendChild(option);

    if (isReplicate_) {
      if (url === replicate_page_url) {
        stored_urls.value = url;
        selected = true;
        remove_button.disabled = false;
        fill_source(url, file);
      }
      continue;
    }

    if (needsContent) {
      needsContent = false;
      stored_urls.value = url;
      selected = true;
      remove_button.disabled = false;
      url_field.value = url;
      const file = files[url];
      match_field.value = file.match;
      fill_source(url, file);
    }
    if (url_field.value === url) {
      stored_urls.value = url;
      selected = true;
    }
  }

  if (!selected) {
    remove_button.disabled = true;
  }
}

async function fillUsedList(urls) {
  let defaultText;
  if (urls.length > 0) {
    defaultText = "--- Select URL to load ---";
  } else {
    defaultText = "--- No resources ---";
  }
  initList(used_urls, defaultText);

  for (const url of urls.sort()) {
    if (url.startsWith("about:")) {
      continue;
    }

    const option = document.createElement("option");
    option.value = url;
    option.textContent = url;
    used_urls.appendChild(option);
  }
}

let replicate_promise_map = new Map();

function filter_filename(filename) {
  return filename.replace(/[%$&~\\:;\*\?\"\'\| <>\[\]\(\)]/g, "_");
}

function get_filename(url, files) {
  url = url.replace(/#.*$/, "");
  url = url.replace(/\?.*$/, "");

  let name, ext;

  const m = url.match(/\/([^\/\.]+)\.([^\/]+)$/);
  if (m) {
    name = m[1];
    ext = "." + m[2];
  } else {
    const m = url.match(/\/([^\/]+)$/);
    if (m) {
      name = m[1];
      ext = ".html";
    } else {
      name = "index";
      ext = ".html";
    }
  }

  if (name.length > 80) {
    name = name.slice(0, 80);
  }

  const filename = filter_filename(`${name}${ext}`);
  if (!files.has(filename)) {
    return filename;
  }

  let i = 2;
  while (true) {
    const filename = filter_filename(`${name}-${i}${ext}`);
    if (!files.has(filename)) {
      return filename;
    }
    i++;
  }
}

async function download_script() {
  const urls = [];
  used_urls.querySelectorAll("option").forEach(option => {
    if (option.value.startsWith("---")) {
      return;
    }
    urls.push(option.value);
  });

  const port = replicate_port.value;

  const files = new Map();

  const metafiles = new Set(["README.txt", "ditm-replicate.json"]);

  files.set("README.txt", { url: null, content: "" });
  files.set("ditm-replicate.json", { url: null, content: "" });

  replicate_progress.style.display = "";
  replicate_progress.value = 0;

  replicate_list = [];

  for (const url of urls) {
    const contentPromise = new Promise((resolve, reject) => {
      replicate_promise_map.set(url, [resolve, reject]);

      replicate_status.textContent = `Loading ${url}`;

      browser.runtime.sendMessage({
        topic: "load",
        url,
      });
    });

    let content;

    try {
      content = await contentPromise;
    } catch (e) {
      continue;
    }

    let filename = get_filename(url, files);

    files.set(filename, { url, content });

    const local_url = `http://localhost:${port}/${filename}`;
    replicate_list.push([url, local_url]);

    replicate_progress.value = Math.round(100 * files.size / urls.length);
  }

  replicate_status.textContent = `Loaded ${replicate_list.length} files`;

  const [page_url, error] = await browser.devtools.inspectedWindow.eval(`
document.location.href;
`);

  replicate_page_url = page_url;

  let README = `\
This directory contains replica of
${replicate_page_url}

Files map to the following URLs:
`;

  for (const [filename, file] of files) {
    if (metafiles.has(filename)) {
      continue;
    }

    README += `\
  * ${filename} : ${file.url}
`;
  }

  README += `\

The data can be loaded into the another DITM instance by drag-and-dropping
ditm-replicate.json file into the DITM pane.
`;

  files.get("README.txt").content = README;

  files.get("ditm-replicate.json").content = JSON.stringify({
    page: page_url,
    list: replicate_list
  });

  let script = `\
#!/usr/bin/env python3

import base64
import os
import subprocess
import sys

dir = 'ditm-replica'
port = '${port}'

i = 2;
while os.path.exists(dir):
    dir = 'ditm-replica-{}'.format(i)
    i += 1

os.mkdir(dir)

files = [
`;

  if (auto_prettify_js.checked) {
    for (const [filename, file] of files) {
      if (!filename.match(/\.(js|mjs)($|\?|#)/)) {
        continue;
      }

      replicate_status.textContent = `Prettifying ${file.url}`;

      const result = await prettifyText(file.content);
      if (!result.error) {
        file.content = result.response.code;
      }
    }
  }

  for (const [filename, file] of files) {
    const encoder = new TextEncoder();
    const data = encoder.encode(file.content);
    const codes = [];
    for (var c of data) {
      codes.push(String.fromCharCode(c));
    }
    const raw = codes.join("");
    let b64 = btoa(raw);

    let b64_lines = "";
    while (b64.length > 72) {
      const line = b64.slice(0, 72);
      b64_lines += `\
${line}
`;
      b64 = b64.slice(72);
    }
    b64_lines += `\
${b64}
`;

    script += `\
['${filename}',
b"""
${b64_lines}
"""],
`;
  }

script += `\
]

print('Extracting...')

for file in files:
    filename = file[0]
    b64 = file[1]
    content = base64.decodebytes(b64).decode()

    print(os.path.join(dir, filename))

    with open(os.path.join(dir, filename), 'w') as f:
      f.write(content)
`;

  if (replicate_server.checked) {
    script += `\

print('Running HTTP server...')

os.chdir(dir)
subprocess.run(['python3', '-m', 'http.server', port])
`;
} else {
    script += `\

print('Run the following to start server:')
print('$ cd {} && python3 -m http.server {}'.format(dir, port))
`;
  }

  replicate_script = script;

  replicate_status.textContent = `Created ditm-replicate.py with ${files.size} files`;

  const url = URL.createObjectURL(new Blob([replicate_script]));
  const a = document.createElement("a");
  a.download = "ditm-replicate.py";
  a.href = url;
  replicate_download.after(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  replicate_start.disabled = false;

  start_replicate();
}

function start_replicate() {
  browser.runtime.sendMessage({
    topic: "replicate-start",
    page: replicate_page_url,
    list: replicate_list,
  });
}

function stop_replicate() {
  replicate_start.disabled = false;
  replicate_stop.disabled = true;

  browser.runtime.sendMessage({
    topic: "replicate-stop",
    page: replicate_page_url,
  });
}

function add_log(message) {
  const item = document.createElement("div");
  item.className = "log-item";

  const icon_box = document.createElement("div");

  const icon = document.createElement("span");
  switch (message.type) {
    case "text":
      icon.className = "log-item-icon log-item-icon-text";
      icon.textContent = "TEXT";
      break;
    case "url":
      icon.className = "log-item-icon log-item-icon-url";
      icon.textContent = "URL";
      break;
    case "replicate":
      icon.className = "log-item-icon log-item-icon-replicate";
      icon.textContent = "REPLICATE";
      break;
  }
  icon_box.appendChild(icon);
  item.appendChild(icon_box);

  const body = document.createElement("div");
  body.className = "log-item-body";


  const url_box = document.createElement("div");
  const url = document.createElement("span");
  url.className = "log-item-url";
  url.textContent = message.url;
  url_box.appendChild(url);
  body.appendChild(url_box);

  if (message.type === "url" || message.type === "replicate") {
    const redirect_box = document.createElement("div");
    redirect_box.appendChild(document.createTextNode("=> "));
    const url = document.createElement("span");
    url.className = "log-item-url";
    url.textContent = message.redirect;
    redirect_box.appendChild(url);
    body.appendChild(redirect_box);
  }

  const info_box = document.createElement("div");
  const size = document.createElement("span");
  size.textContent = `Sent ${message.size} bytes`;
  info_box.appendChild(size);
  body.appendChild(info_box);

  item.appendChild(body);
  log_box.appendChild(item);

  log_scroll_to_bottom();
}

function clear_log() {
  log_box.textContent = "";
}

let initialList = true;
browser.runtime.onMessage.addListener(async message => {
  switch (message.topic) {
    case "load": {
      if (isReplicate()) {
        const url = message.url;
        const content = message.content;
        if (replicate_promise_map.has(url)) {
          const [resolve, reject] = replicate_promise_map.get(url);
          replicate_promise_map.delete(url);
          resolve(content);
        }
      } else {
        status("Loaded content.");
        source_text.value = message.content;
        source_url.value = "";
      }
      break;
    }
    case "load:failed": {
      if (isReplicate()) {
        const url = message.url;
        if (replicate_promise_map.has(url)) {
          const [resolve, reject] = replicate_promise_map.get(url);
          replicate_promise_map.delete(url);
          reject();
        }
      } else {
        status("Loaded failed.");
      }
      break;
    }
    case "invalid-url": {
      if (message.kind === "invalid") {
        status("Invalid URL.");
      } else if (message.kind === "unsupported") {
        status("This protocol is not supported.");
      }
      break;
    }
    case "list": {
      if (initialList) {
        initialList = false;

        refresh();
      }
      files = message.files;
      files_resolve(files);
      fillStoredList();
      break;
    }
    case "url-history": {
      url_history = message.history;
      filLDataList(source_url_history, url_history);
      break;
    }
    case "log-item": {
      add_log(message);
      break;
    }
  }
});

browser.devtools.network.onNavigated.addListener(url => {
  refresh();
});

fillUsedList([]);

browser.runtime.sendMessage({
  topic: "list",
});
browser.runtime.sendMessage({
  topic: "get-url-history",
});

pingLog();
setInterval(pingLog, 5000);

function pingLog() {
  browser.runtime.sendMessage({
    topic: "ping-log",
  });
}
