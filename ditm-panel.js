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

document.getElementById("save").addEventListener("click", save);
document.getElementById("load").addEventListener("click", load);
document.getElementById("remove").addEventListener("click", remove);
document.getElementById("gather").addEventListener("click", gather);
const stored_urls = document.getElementById("stored-urls");
stored_urls.addEventListener("change", select_stored);
const used_urls = document.getElementById("used-urls");
used_urls.addEventListener("change", select_used);

async function load() {
  browser.runtime.sendMessage({
    topic: "load",
    url: url_field.value,
  });
}
async function save() {
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
  browser.runtime.sendMessage({
    topic: "remove",
    url,
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
    const file = files[stored_urls.value];
    content_field.value = file;
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
    url_field.value = url;
    await load();
  } catch (e) {
    console.log(e.toString());
  }
}
async function gather() {
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
      console.log("Exception: " + error.value);
    }
    else if ("isError" in error && error.isError) {
      console.log("Error: " + error.code);
    }
    else {
      console.log("Unknown error: " + error);
    }
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

async function fillStoredList() {
  initList(stored_urls);

  for (const url of Object.keys(files).sort()) {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = url;
    stored_urls.appendChild(option);

    if (needsContent) {
      needsContent = false;
      option.selected = true;
      url_field.value = url;
      content_field.value = files[url];
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

browser.runtime.onMessage.addListener(message => {
  switch (message.topic) {
    case "load": {
      content_field.value = message.content;
      break;
    }
    case "list": {
      files = message.files;
      files_resolve(files);
      fillStoredList();
      break;
    }
  }
});
browser.runtime.sendMessage({
  topic: "list",
});
