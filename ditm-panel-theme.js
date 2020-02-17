function updateThemeClass() {
  if (browser.devtools.panels.themeName == "dark") {
    document.documentElement.classList.remove("theme-light");
    document.documentElement.classList.add("theme-dark");
  } else {
    document.documentElement.classList.remove("theme-dark");
    document.documentElement.classList.add("theme-light");
  }
}

browser.devtools.panels.onThemeChanged.addListener(updateThemeClass);
updateThemeClass();
