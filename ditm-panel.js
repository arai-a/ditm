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
  if (event.key == "Enter") {
    load();
  }
});

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
async function select() {
  try {
    await files_promise;

    const url = stored_urls.value;
    url_field.value = url;
    const file = files[stored_urls.value];
    content_field.value = file;
  } catch (e) {
    console.log(e.toString());
  }
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("load").addEventListener("click", load);
document.getElementById("remove").addEventListener("click", remove);
const stored_urls = document.getElementById("stored-urls");
stored_urls.addEventListener("change", select);

browser.runtime.onMessage.addListener(message => {
  switch (message.topic) {
    case "load": {
      content_field.value = message.content;
      break;
    }
    case "list": {
      while (stored_urls.firstChild) {
        stored_urls.firstChild.remove();
      }
      files = message.files;
      files_resolve(files);

      for (const url of Object.keys(files).sort()) {
        const option = document.createElement("option");
        option.value = url;
        option.textContent = url;
        stored_urls.appendChild(option);

        if (needsContent) {
          needsContent = false;
          url_field.value = url;
          content_field.value = files[url];
        }
      }
      break;
    }
  }
});
browser.runtime.sendMessage({
  topic: "list",
});
