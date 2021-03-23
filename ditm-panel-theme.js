function updateThemeClass() {
  if (browser.devtools.panels.themeName == "dark") {
    document.documentElement.classList.remove("theme-light");
    document.documentElement.classList.add("theme-dark");
  } else {
    document.documentElement.classList.remove("theme-dark");
    document.documentElement.classList.add("theme-light");
  }
}

function setPlatformClass() {
  let os;
  const platform = navigator.platform;
  if (platform.startsWith("Win")) {
    os = "win";
  } else if (platform.startsWith("Mac")) {
    os = "mac";
  } else {
    os = "linux";
  }

  document.documentElement.setAttribute("platform", os);
}

setPlatformClass();
browser.devtools.panels.onThemeChanged.addListener(updateThemeClass);
updateThemeClass();
