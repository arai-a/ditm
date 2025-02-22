let files;

let flatten_files_exact;
let flatten_files_forward;
let flatten_files_wildcard;

let url_history;
let patternCache = {};
let lastLogPing = 0;
let isLogging = false;
const PING_TTL = 10 * 1000;

function update_flatten_files() {
  flatten_files_exact = {};
  flatten_files_forward = {};
  flatten_files_wildcard = {};

  for (const url in files) {
    const file = files[url];
    if (file.type === "replicate") {
      for (let [url, local_url] of file.content) {
        flatten_files_exact[url] = {
          match: "exact",
          type: "url",
          content: local_url,
        };
      }
    } else {
      switch (file.match) {
        case "exact":
          flatten_files_exact[url] = file;
          break;
        case "forward":
          flatten_files_forward[url] = file;
          break;
        case "wildcard":
          flatten_files_wildcard[url] = file;
          break;
      }
    }
  }
}

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
  if (targetURL in flatten_files_exact) {
    const file = flatten_files_exact[targetURL];
    if (file.match === "exact") {
      return file;
    }
  }

  for (const url in flatten_files_forward) {
    const file = flatten_files_forward[url];
    if (targetURL.startsWith(url)) {
      return file;
    }
  }

  for (const url in flatten_files_wildcard) {
    const file = flatten_files_wildcard[url];
    const pattern = toPattern(url);
    if (pattern.test(targetURL)) {
      return file;
    }
  }

  return null;
}

function sendLog(type, url, redirect, size) {
  if (!isLogging) {
    return;
  }

  browser.runtime.sendMessage({
    topic: "log-item",
    url,
    type,
    size,
    redirect,
  });
  if (Date.now() > lastLogPing + PING_TTL) {
    isLogging = false;
  }
}

async function filterHeader(details) {
  const url = details.url;

  const file = findFile(url);
  if (file) {
    const responseHeaders = details.responseHeaders.filter(
      item => item.name.toLowerCase() !== "cache-control");

    responseHeaders.push({
      name: "Cache-Control",
      value: "no-cache",
    });

    return {
      responseHeaders,
    };
  }

  return undefined;
}

async function filterRequest(details) {
  const url = details.url;

  const filter = browser.webRequest.filterResponseData(details.requestId);
  const encoder = new TextEncoder();

  const file = findFile(url);
  if (file) {
    // Modify the response.
    filter.onstop = event => {
      if (file.type === "text") {
        const data = encoder.encode(file.content);
        const size = data.length;
        filter.write(data);
        filter.disconnect();

        sendLog(file.type, url, "", size, false);
      } else {
        return (async () => {
          const response = await fetch(file.content, { cache: "reload" });
          const data = await response.arrayBuffer();
          const size = data.byteLength;
          filter.write(data);
          filter.disconnect();

          sendLog(file.type, url, file.content, size);
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
    await browser.webRequest.onHeadersReceived.removeListener(filterHeader);
    await browser.webRequest.onBeforeRequest.removeListener(filterRequest);
    added = false;
  }

  const urls = [];
  for (const url in flatten_files_exact) {
    urls.push(url);
  }
  for (const url in flatten_files_forward) {
    urls.push(url + "*");
  }
  for (const url in flatten_files_wildcard) {
    urls.push(url);
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

  await browser.webRequest.onHeadersReceived.addListener(
    filterHeader,
    {
      urls: portlessUrls,
    },
    ["blocking", "responseHeaders"]
  );

  await browser.webRequest.onBeforeRequest.addListener(
    filterRequest,
    {
      urls: portlessUrls,
    },
    ["blocking"]
  );

  await browser.webRequest.handlerBehaviorChanged();
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
    url_loop: for (const url of Object.keys(raw_files)) {
      if (!isValidURL(url)) {
        continue url_loop;
      }

      const file = raw_files[url];
      if (typeof file === "string") {
        files[url] = {
          match: "exact",
          type: "text",
          content: file,
        };
      } else if (typeof file === "object") {
        switch (file.match) {
          case "exact":
          case "forward":
          case "wildcard":
            break;
          default:
            continue url_loop;
        }
        switch (file.type) {
          case "text":
          case "url":
            if (typeof file.content !== "string") {
              continue url_loop;
            }
            break;
          case "replicate":
            if (!Array.isArray(file.content)) {
              continue url_loop;
            }
            for (const item of file.content) {
              if (!Array.isArray(item)) {
                continue url_loop;
              }
              if (item.length !== 2) {
                continue url_loop;
              }
              if (typeof item[0] !== "string") {
                continue url_loop;
              }
              if (typeof item[1] !== "string") {
                continue url_loop;
              }
            }
            break;
          default:
            continue url_loop;
        }
        files[url] = {
          match: file.match,
          type: file.type,
          content: file.content,
        };
      } else {
        continue url_loop;
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
  update_flatten_files();
  url_history = await load_url_history();

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (sender.url !== browser.runtime.getURL("/ditm-panel.html")) {
      return;
    }

    switch (message.topic) {
      case "load": {
        const url = message.url;

        try {
          const response = await fetch(url);
          const content = await response.text();
          browser.runtime.sendMessage({ topic: "load", content, url });
        } catch (e) {
          browser.runtime.sendMessage({ topic: "load:failed", url });
        }
        break;
      }
      case "save": {
        if (isValidURL(message.url)) {
          files[message.url] = {
            match: message.match,
            type: message.type,
            content: message.content,
          };
          update_flatten_files();
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
        files[message.page] = {
          match: "exact",
          type: "replicate",
          content: message.list,
        };
        update_flatten_files();
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "replicate-stop": {
        delete files[message.page];
        update_flatten_files();
        await save();
        await refresh();
        browser.runtime.sendMessage({ topic: "list", files });
        break;
      }
      case "remove": {
        delete files[message.url];
        update_flatten_files();
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
