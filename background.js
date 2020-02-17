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
  } else if (!(url in files)) {
    // Same protocol+hostname+pathname but wrong port, so just passthrough
    filter.ondata = event => {
      filter.write(event.data);
    };
    filter.onstop = event => {
      filter.disconnect();
    };
  } else {
    // Otherwise modify the response.
    filter.onstop = event => {
      console.log("DITM applied", url);
      const file = files[url];
      if (file.type === "text") {
        filter.write(encoder.encode(file.content));
        filter.disconnect();
      } else {
        return (async () => {
          const response = await fetch(file.content, { cache: "reload" });
          const data = await response.arrayBuffer();
          filter.write(data);
          filter.disconnect();
        })();
      }
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

  const portlessUrls = urls.map(url => {
    try {
      url = new URL(url);
      url.port = '';
      return url.href;
    } catch (e) {
      return url;
    }
  });

  await browser.webRequest.onBeforeRequest.addListener(
    filterRequest,
    {
      urls: portlessUrls,
    },
    ["blocking"]
  );
  added = true;
}

async function load() {
  try {
    const { files: raw_files } = await browser.storage.local.get("files");
    if (!raw_files) {
      return {};
    }
    if (typeof raw_files !== "object") {
      return {};
    }
    const files = {};
    for (const url of Object.keys(raw_files)) {
      const file = raw_files[url];
      if (typeof file === "string") {
        files[url] = {
          type: "text",
          content: file,
        };
      } else if (typeof file === "object") {
        const type = file.type === "url" ? "url" : "text";
        const content = (typeof file.content === "string") ? file.content : "";
        files[url] = {
          type,
          content,
        };
      } else {
        return {};
      }
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
  console.log(JSON.stringify(files));

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
        files[message.url] = {
          type: message.type,
          content: message.content,
        };
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
