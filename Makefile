all:
	rm -f ditm.xpi
	zip -9 ditm.xpi \
	    background.js \
	    manifest.json \
	    ditm-dt.html \
	    icon.png \
	    ditm-dt.js \
	    ditm-panel.html \
	    ditm-panel.css \
	    ditm-panel.js

i: all
	open -a FirefoxNightly ditm.xpi

ia: all
	open -a FirefoxAurora ditm.xpi
