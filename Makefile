all:
	rm -f ditm.xpi
	zip -9 ditm.xpi \
	    background.js \
	    manifest.json \
	    ditm-dt.html \
	    ditm-dt.js \
	    ditm-panel.html \
	    *.css \
	    ditm-panel.js \
	    ditm-panel-theme.js \
	    pretty-print-worker.js \
	    images/*.svg \
	    images/*.png

i: all
	open -a FirefoxNightly ditm.xpi

ia: all
	open -a FirefoxAurora ditm.xpi
