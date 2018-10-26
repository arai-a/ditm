let needsContent = true;

let files_resolve;
let files;
const files_promise = new Promise(resolve => {
  files_resolve = resolve;
});

const content_field = document.getElementById("content");
content_field.placeholder = `1. Enter URL above
2. Hit [Load] or enter
3. Modify content
4. Hit [Save]
5. Load the webpage`;

const url_field = document.getElementById("url");
url_field.addEventListener("keypress", async event => {
  if (event.key === "Enter") {
    load();
  }
});

const status_field = document.getElementById("status");

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
  status(`Loading ${url} ...`);
  browser.runtime.sendMessage({
    topic: "load",
    url,
  });
}
async function save() {
  status(`Saved`);
  browser.runtime.sendMessage({
    topic: "save",
    url: url_field.value,
    content: content_field.value,
  });
}
async function remove() {
  const url = url_field.value;
  url_field.value = "";
  content_field.value = "";
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
    const file = files[stored_urls.value];
    content_field.value = file;
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
async function gather() {
  status("Gathering URLs used in page...");
  const [urls, error] = await browser.devtools.inspectedWindow.eval(`
(function () {
  const urls = [];
  function gatherFromScript(script) {
    const src = script.src;
    if (src) {
      urls.push(src)
    }
  }
  function gatherFromCSSLink(link) {
    const href = link.href;
    const rel = link.rel;
    if (rel === "stylesheet" && href) {
      urls.push(href)
    }
  }
  function gatherFromFrame(frame) {
    const src = frame.src;
    if (src) {
      urls.push(src)
    }
    try {
      gatherFromDocument(frame.contentDocument);
    } catch (e) {
    }
  }
  function gatherFromDocument(doc) {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      gatherFromScript(scripts[i]);
    }
    const links = document.getElementsByTagName("link");
    for (let i = 0; i < links.length; i++) {
      gatherFromCSSLink(links[i]);
    }
    const frames = document.getElementsByTagName("frame");
    for (let i = 0; i < frames.length; i++) {
      gatherFromFrame(frames[i]);
    }
    const iframes = document.getElementsByTagName("iframe");
    for (let i = 0; i < iframes.length; i++) {
      gatherFromFrame(iframes[i]);
    }
  }
  urls.push(document.location.href);
  gatherFromDocument(document);

  return urls;
})();
`);
  if (error) {
    if ("isException" in error && error.isException) {
      status("Exception: " + error.value);
    }
    else if ("isError" in error && error.isError) {
      status("Error: " + error.code);
    }
    else {
      status("Unknown error: " + error);
    }
    return;
  }

  status("Gathered URLs used in page.");
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
      content_field.value = files[url];
    }
    if (url_field.value === url) {
      stored_urls.value = url;
    }
  }
}

async function fillUsedList(urls) {
  initList(used_urls);

  for (const url of urls.sort()) {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = url;
    used_urls.appendChild(option);
  }
}

let initialList = true;
browser.runtime.onMessage.addListener(message => {
  switch (message.topic) {
    case "load": {
      status("Loaded content.");
      content_field.value = message.content;
      break;
    }
    case "list": {
      if (initialList) {
        initialList = false;
        status("Loaded saved list.");

        gather();
      }
      files = message.files;
      files_resolve(files);
      fillStoredList();
      break;
    }
  }
});

fillUsedList([]);

status("Loading saved list..");
browser.runtime.sendMessage({
  topic: "list",
});
