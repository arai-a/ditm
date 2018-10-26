// TODO: prepare smaller icon

function icon() {
  switch (browser.devtools.panels.themeName) {
    case "dark": {
      return "/icon-dark.png";
    }
    default: {
      return "/icon.png";
    }
  }
}

async function run() {
  await browser.devtools.panels.create("DITM", icon(), "/ditm-panel.html");
}
run();
