let needsContent = true;

let files_resolve;
let files;
let url_history = [];
const files_promise = new Promise(resolve => {
  files_resolve = resolve;
});

const source_text_box = document.getElementById("source-text-box");
const source_url_box = document.getElementById("source-url-box");

const source_text = document.getElementById("source-text");
source_text.placeholder = `1. Select URL from "Used" list
2. Modify content
3. Hit save \u2713 button
4. Reload the webpage`;

const source_url = document.getElementById("source-url");
source_url.addEventListener("keypress", async event => {
  if (event.key === "Enter") {
    save();
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
    load();
  }
});

const status_fields = [
  document.getElementById("status-text"),
  document.getElementById("status-url"),
];

const source_tabs_text_tab = document.getElementById("source-tabs-text-tab");
const source_tabs_url_tab = document.getElementById("source-tabs-url-tab");

function show(type) {
  if (type === "text") {
    source_text_box.style.display = "";
    source_url_box.style.display = "none";
    pretty_button.disabled = false;
    source_tabs_text_tab.classList.add("active");
    source_tabs_url_tab.classList.remove("active");
  } else {
    source_text_box.style.display = "none";
    source_url_box.style.display = "";
    pretty_button.disabled = true;
    source_tabs_text_tab.classList.remove("active");
    source_tabs_url_tab.classList.add("active");
  }
}

source_tabs_text_tab.addEventListener("click", () => {
  show("text");
});
source_tabs_url_tab.addEventListener("click", () => {
  show("url");
});

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

document.getElementById("save-text").addEventListener("click", save);
document.getElementById("save-url").addEventListener("click", save);

document.getElementById("load-text").addEventListener("click", load);

const remove_button = document.getElementById("remove");
remove_button.addEventListener("click", remove);
remove_button.disabled = true;

const pretty_button = document.getElementById("pretty");
pretty_button.addEventListener("click", pretty);

document.getElementById("refresh").addEventListener("click", refresh);

const stored_urls = document.getElementById("stored-urls");
stored_urls.addEventListener("change", select_stored);

const used_urls = document.getElementById("used-urls");
used_urls.addEventListener("change", select_used);

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
    type,
    content,
  });
  status(`Saved`);
}
async function remove() {
  const url = url_field.value;
  url_field.value = "";
  show("text");
  source_text.value = "";
  source_url.value = "";
  needsContent = true;
  status(`Removed`);
  browser.runtime.sendMessage({
    topic: "remove",
    url,
  });
  remove_button.disabled = true;
}
async function pretty() {
  const worker = new Worker("pretty-print-worker.js");
  worker.onmessage = msg => {
    if (msg.data.results[0].error) {
      status(msg.data.results[0].message);
    } else {
      source_text.value = msg.data.results[0].response.code;
    }
  };
  worker.postMessage({
    id: 1,
    method: "prettyPrint",
    calls: [
      [
        {
          url: "foo",
          indent: 2,
          sourceText: source_text.value,
        }
      ]
    ]
  });
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
    fill_source(files[stored_urls.value]);
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

  fillUsedList(urls);
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

function fill_source(file) {
  if (file.type === "text") {
    source_text.value = file.content;
    source_url.value = "";
    show("text");
  } else {
    source_text.value = "";
    source_url.value = file.content;
    show("url");
  }
}

async function fillStoredList() {
  let defaultText;
  if (Object.keys(files).length > 0) {
    defaultText = "--- Select URL to load ---";
  } else {
    defaultText = "--- Nothing is saved ---";
  }
  initList(stored_urls, defaultText);

  for (const url of Object.keys(files).sort()) {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = url;
    stored_urls.appendChild(option);

    if (needsContent) {
      needsContent = false;
      stored_urls.value = url;
      remove_button.disabled = false;
      url_field.value = url;
      fill_source(files[url]);
    }
    if (url_field.value === url) {
      stored_urls.value = url;
    }
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

let initialList = true;
browser.runtime.onMessage.addListener(async message => {
  switch (message.topic) {
    case "setLoadingURL:done": {
      const url = message.url;
      const urlString = `"${url.replace(/[\"\\]/g, "\\$1")}"`;
      await browser.devtools.inspectedWindow.eval(`
fetch(${urlString});
`);
      break;
    }
    case "load": {
      status("Loaded content.");
      source_text.value = message.content;
      source_url.value = "";
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
