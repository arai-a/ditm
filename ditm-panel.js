let needsContent = true;

let files_resolve;
let files;
const files_promise = new Promise(resolve => {
  files_resolve = resolve;
});

const source_text_box = document.getElementById("source-text-box");
const source_url_box = document.getElementById("source-url-box");

const source_text = document.getElementById("source-text");
source_text.placeholder = `1. Enter URL above
2. Hit [Load] or enter
3. Modify content
4. Hit [Save]
5. Load the webpage`;

const source_url = document.getElementById("source-url");
source_url.addEventListener("keypress", async event => {
  if (event.key === "Enter") {
    save();
  }
});

const url_field = document.getElementById("url");
url_field.addEventListener("keypress", async event => {
  if (event.key === "Enter") {
    load();
  }
});

const status_field = document.getElementById("status");

const source_chooser_text = document.getElementById("source-chooser-text");
source_chooser_text.checked = true;
const source_chooser_url = document.getElementById("source-chooser-url");

function show(type) {
  if (type === "text") {
    source_chooser_text.checked = true;
    source_chooser_url.checked = false;
    source_text_box.style.display = "flex";
    source_url_box.style.display = "none";
  } else {
    source_chooser_text.checked = false;
    source_chooser_url.checked = true;
    source_text_box.style.display = "none";
    source_url_box.style.display = "block";
  }
}

source_chooser_text.addEventListener("click", () => {
  show("text");
});
source_chooser_url.addEventListener("click", () => {
  show("url");
});

const STATUS_TIMEOUT = 10 * 1000;
let statusTimer = null;
function status(text) {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  status_field.textContent = text;
  setTimeout(() => {
    status_field.textContent = "";
  }, STATUS_TIMEOUT);
}

document.getElementById("save").addEventListener("click", save);

document.getElementById("load").addEventListener("click", load);

const remove_button = document.getElementById("remove");
remove_button.addEventListener("click", remove);
remove_button.disabled = true;

document.getElementById("gather").addEventListener("click", gather);

const stored_urls = document.getElementById("stored-urls");
stored_urls.addEventListener("change", select_stored);

const used_urls = document.getElementById("used-urls");
used_urls.addEventListener("change", select_used);

async function load() {
  const url = url_field.value;
  status(`Loading...`);
  browser.runtime.sendMessage({
    topic: "load",
    url,
  });
}
async function save() {
  const is_text = source_chooser_text.checked;
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
async function gather() {
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

async function initList(list) {
  while (list.firstChild) {
    list.firstChild.remove();
  }

  const option = document.createElement("option");
  option.value = "---";
  option.textContent = "---";
  list.appendChild(option);
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
  initList(stored_urls);

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
  initList(used_urls);

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
      show("text");
      break;
    }
    case "list": {
      if (initialList) {
        initialList = false;

        gather();
      }
      files = message.files;
      files_resolve(files);
      fillStoredList();
      break;
    }
  }
});

browser.devtools.network.onNavigated.addListener(url => {
  gather();
});

fillUsedList([]);

browser.runtime.sendMessage({
  topic: "list",
});
