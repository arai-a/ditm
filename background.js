let files;

async function onBeforeRequest(details) {
  await files;
  const url = details.url;
  console.log("DITM applied", url);
  const content = files[url];

  let filter = browser.webRequest.filterResponseData(details.requestId);
  let encoder = new TextEncoder();

  filter.onstop = event => {
    filter.write(encoder.encode(content));
    filter.disconnect();
  };
}

let added = false;
async function refresh() {
  if (added) {
    browser.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
    added = false;
  }

  const urls = Object.keys(files);
  if (urls.length === 0) {
    return;
  }

  browser.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    {
      urls,
    },
    ["blocking"]
  );
  added = true;
}

async function load() {
  try {
    const { files } = await browser.storage.local.get("files");
    if (!files) {
      return {};
    }
    return files;
  } catch (e) {
    return {};
  }
}

async function save() {
  await browser.storage.local.set({ files });
}

async function run() {
  files = await load();

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (sender.url !== browser.runtime.getURL("/ditm-panel.html")) {
      return;
    }

    switch (message.topic) {
      case "load": {
        const response = await fetch(message.url);
        const content = await response.text();
        browser.runtime.sendMessage({ topic: "load", content });
        break;
      }
      case "save": {
        files[message.url] = message.content;
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "remove": {
        delete files[message.url];
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "list": {
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
    }
  });

  refresh();
}
run();
