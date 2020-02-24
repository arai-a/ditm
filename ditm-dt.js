function icon() {
  switch (browser.devtools.panels.themeName) {
    case "dark": {
      return "/images/tab-dark.svg";
    }
    default: {
      return "/images/tab-light.svg";
    }
  }
}

async function run() {
  await browser.devtools.panels.create("DITM", icon(), "/ditm-panel.html");
}
run();
