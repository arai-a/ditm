let files;
let loadingURL = null;
let retrying = false;
async function filterRequest(details) {
  const url = details.url;

  const filter = browser.webRequest.filterResponseData(details.requestId);
  const encoder = new TextEncoder();

  if (loadingURL === url) {
    // If we are loading the URL, get the response and pass it back to panel.
    let content = "";
    const decoder = new TextDecoder("utf-8");
    filter.ondata = event => {
      const str = decoder.decode(event.data, {stream: true});
      filter.write(encoder.encode(str));
      content += str;
    };
    filter.onstop = event => {
      if (content || retrying) {
        loadingURL = null;
        browser.runtime.sendMessage({ topic: "load", content });
        refresh();
      } else {
        // Fallback to fetching from eval in the tab, and keep listening.
        retrying = true;
      }
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
    await browser.webRequest.onBeforeRequest.removeListener(filterRequest);
    added = false;
  }

  const urls = Object.keys(files);
  if (loadingURL) {
    urls.push(loadingURL);
  }
  if (urls.length === 0) {
    return;
  }

  await browser.webRequest.onBeforeRequest.addListener(
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
      case "load": {
        const url = message.url;
        loadingURL = url;
        retrying = false;
        await refresh();

        try {
          // First try to fetch from background script.
          await fetch(url);
        } catch (e) {
          // fetch in background script may fail because of tracking protection.
          // Fallback to fetching from eval in the tab.
          browser.runtime.sendMessage({ topic: "setLoadingURL:done", url });
        }
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
