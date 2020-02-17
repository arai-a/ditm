all:
	rm -f ditm.xpi
	zip -9 ditm.xpi \
	    background.js \
	    manifest.json \
	    ditm-dt.html \
	    icon.png \
	    icon-dark.png \
	    ditm-dt.js \
	    ditm-panel.html \
	    ditm-panel.css \
	    ditm-panel.js \
	    pretty-print-worker.js

i: all
	open -a FirefoxNightly ditm.xpi

ia: all
	open -a FirefoxAurora ditm.xpi
