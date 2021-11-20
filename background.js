let files;
let url_history;
let loadingURL = null;
let retrying = false;
let patternCache = {};
let lastLogPing = 0;
let isLogging = false;
const PING_TTL = 10 * 1000;

function toPattern(url) {
  if (url in patternCache) {
    return patternCache[url];
  }

  const pattern = new RegExp(url
                             .replace(/([\^\$\\\.\+\?\(\)\[\]\{\}\|])/g, "\\$1")
                             .replace(/\*/, ".*"));
  patternCache[url] = pattern;
  return pattern;
}

function findFile(targetURL) {
  if (targetURL in files) {
    const file = files[targetURL];
    if (file.match === "exact") {
      return file;
    }
  }

  for (const url in files) {
    const file = files[url];
    if (file.match === "forward") {
      if (targetURL.startsWith(url)) {
        return file;
      }
    } else if (file.match === "wildcard") {
      const pattern = toPattern(url);
      if (pattern.test(targetURL)) {
        return file;
      }
    }
  }

  return null;
}

function sendLog(type, url, redirect, size, replicate) {
  browser.runtime.sendMessage({
    topic: "log-item",
    url,
    type,
    size,
    redirect,
    replicate,
  });
  if (Date.now() > lastLogPing + PING_TTL) {
    isLogging = false;
  }
}

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
        browser.runtime.sendMessage({ topic: "load", content, url });
        refresh();
      } else {
        // Fallback to fetching from eval in the tab, and keep listening.
        retrying = true;
      }
      filter.disconnect();
    };
    return;
  }

  const file = findFile(url);
  if (file) {
    // Modify the response.
    filter.onstop = event => {
      if (file.type === "text") {
        const data = encoder.encode(file.content);
        const size = data.length;
        filter.write(data);
        filter.disconnect();

        if (isLogging) {
          sendLog(file.type, url, "", size, false);
        }
      } else {
        return (async () => {
          const response = await fetch(file.content, { cache: "reload" });
          const data = await response.arrayBuffer();
          const size = data.byteLength;
          filter.write(data);
          filter.disconnect();

          if (isLogging) {
            sendLog(file.type, url, file.content, size, !!file.replicate);
          }
        })();
      }

      return undefined;
    };

    return;
  }

  // Same protocol+hostname+pathname but wrong port, so just passthrough
  filter.ondata = event => {
    filter.write(event.data);
  };
  filter.onstop = event => {
    filter.disconnect();
  };
}

function getURLKind(text) {
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return "ok";
    }
    return "unsupported";
  } catch (e) {
    return "invalid";
  }
  return true;
}

function isValidURL(text) {
  return getURLKind(text) === "ok";
}

let added = false;
async function refresh() {
  if (added) {
    await browser.webRequest.onBeforeRequest.removeListener(filterRequest);
    added = false;
  }

  const urls = [];
  for (const url in files) {
    const file = files[url];
    if (file.match === "exact" || file.match === "wildcard") {
      urls.push(url);
    } else if (file.match === "forward") {
      urls.push(url + "*");
    }
  }
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
      if (!isValidURL(url)) {
        continue;
      }

      const file = raw_files[url];
      if (typeof file === "string") {
        files[url] = {
          match: "exact",
          type: "text",
          content: file,
        };
      } else if (typeof file === "object") {
        let match;
        switch (file.match) {
          case "exact":
          case "forward":
          case "wildcard":
            match = file.match;
            break;
          default:
            match = "exact";
            break;
        }
        const type = file.type === "url" ? "url" : "text";
        const content = (typeof file.content === "string") ? file.content : "";
        const replicate = !!file.replicate;
        files[url] = {
          match,
          type,
          content,
          replicate,
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

async function load_url_history() {
  try {
    const { url_history } = await browser.storage.local.get("url_history");
    if (!url_history) {
      return [];
    }
    return url_history;
  } catch (e) {
    return [];
  }
}

async function save() {
  await browser.storage.local.set({ files, url_history });
}

async function run() {
  files = await load();
  url_history = await load_url_history();

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
        if (isValidURL(message.url)) {
          files[message.url] = {
            match: message.match,
            type: message.type,
            content: message.content,
            replicate: message.replicate,
          };
          if (message.type === "url") {
            if (!url_history.includes(message.content)) {
              url_history.unshift(message.content);
              if (url_history.length > 6) {
                url_history.length = 6;
              }
            }
          }
          await save();
          await refresh();
          browser.runtime.sendMessage({ topic: "list", files });
          browser.runtime.sendMessage({ topic: "url-history", history: url_history });
        } else {
          browser.runtime.sendMessage({
            topic: "invalid-url",
            url: message.url,
            kind: getURLKind(message.url),
          });
        }
        break;
      }
      case "replicate-start": {
        for (const [url, local_url] of message.list) {
          files[url] = {
            match: "exact",
            type: "url",
            replicate: true,
            content: local_url,
          };
        }
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "replicate-stop": {
        for (const [url, local_url] of message.list) {
          delete files[url];
        }
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "remove": {
        delete files[message.url];
        patternCache = {};
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "list": {
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "get-url-history": {
        browser.runtime.sendMessage({ topic: "url-history", history: url_history });
        break;
      }
      case "clear-url-history": {
        url_history = [];
        await save();
        browser.runtime.sendMessage({ topic: "url-history", history: url_history });
        break;
      }
      case "ping-log": {
        lastLogPing = Date.now();
        isLogging = true;
        break;
      }
    }
  });

  refresh();
}
run();
