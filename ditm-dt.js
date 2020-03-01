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
  console.log("@@@@ run");
  const panel = await browser.devtools.panels.create("DITM", icon(), "/ditm-panel.html");
  console.log("@@@@1", Object.getOwnPropertyDescriptor(panel, "setIcon"));
  console.log("@@@@2", Object.getPrototypeOf(panel).constructor.name);
  console.log("@@@@3", Object.getOwnPropertyDescriptor(Object.getPrototypeOf(panel), "setIcon"));

  console.log("@@@@ panel", panel);
  browser.devtools.panels.onThemeChanged.addListener(() => {
    console.log("@@@@ onThemeChanged");
    try {
      panel.setIcon(icon());
      console.log("@@@@ setIcon called");
    } catch (e) {
      console.log("@@@@ setIcon error", e);
    }
  });
}
run();
