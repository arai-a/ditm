async function run() {
  await browser.devtools.panels.create("DITM", "/icon.png", "/ditm-panel.html");
}
run();
