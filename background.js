let files;
let loadingURL = null;
async function filterRequest(details) {
  const url = details.url;

  const filter = browser.webRequest.filterResponseData(details.requestId);
  const encoder = new TextEncoder();

  if (loadingURL === url) {
    loadingURL = null;
    await refresh();
    // If we are loading the URL, get the response and pass it back to panel.
    let content = "";
    const decoder = new TextDecoder("utf-8");
    filter.ondata = event => {
      const str = decoder.decode(event.data, {stream: true});
      filter.write(encoder.encode(str));
      content += str;
    };
    filter.onstop = event => {
      browser.runtime.sendMessage({ topic: "load", content });
      filter.disconnect();
    };
  } else {
    // Otherwise modify the response.
    filter.onstop = event => {
      console.log("DITM applied", url);
      const content = files[url];
      filter.write(encoder.encode(content));
      filter.disconnect();
    };
  }
}

let added = false;
async function refresh() {
  if (added) {
    browser.webRequest.onBeforeRequest.removeListener(filterRequest);
    added = false;
  }

  const urls = Object.keys(files);
  if (loadingURL) {
    urls.push(loadingURL);
  }
  if (urls.length === 0) {
    return;
  }

  browser.webRequest.onBeforeRequest.addListener(
    filterRequest,
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
      case "setLoadingURL": {
        const url = message.url;
        loadingURL = url;
        await refresh();
        browser.runtime.sendMessage({ topic: "setLoadingURL:done", url });
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
