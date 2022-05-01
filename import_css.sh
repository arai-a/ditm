M_C=$1

if [ "x${M_C}" = "x" ]; then
    echo "Usage import_css.sh PATH_TO_MOZILLA_CENTRAL" > /dev/stderr
    exit 1
fi

cp ${M_C}/devtools/client/themes/common.css devtools-common.css
sed -i .bak -e 's|^@import\(.*\);$||' devtools-common.css
sed -i .bak -e 's|chrome://devtools/skin/images/|./images/|' devtools-common.css
sed -i .bak -e 's|chrome://devtools/skin/images/|./images/|' devtools-common.css
sed -i .bak -e 's|chrome://browser/skin/|./images/|' devtools-common.css
sed -i .bak -e 's|chrome://global/skin/icons/|./images/|' devtools-common.css

cp ${M_C}/devtools/client/themes/splitters.css devtools-splitters.css
cp ${M_C}/devtools/client/themes/variables.css devtools-variables.css

cp ${M_C}/devtools/client/themes/toolbars.css devtools-toolbars.css
sed -i .bak -e 's|chrome://devtools/skin/images/|./images/|' devtools-toolbars.css

cp ${M_C}/devtools/client/themes/tooltips.css devtools-tooltips.css
sed -i .bak -e 's|chrome://global/skin/icons/|./images/|' devtools-tooltips.css
sed -i .bak -e 's|chrome://devtools/skin/images/|./images/|' devtools-tooltips.css
sed -i .bak -e 's|resource://devtools/client/shared/components/reps/images/|./images/|' devtools-tooltips.css
sed -i .bak -e 's|chrome://devtools/content/shared/components/reps/images/|./images/|' devtools-tooltips.css
sed -i .bak -e 's|^@import\(.*\);$||' devtools-tooltips.css


cp ${M_C}/devtools/client/debugger/src/components/variables.css debugger-variables.css
cp ${M_C}/devtools/client/debugger/src/components/Editor/Tabs.css debugger-Tabs.css
cp ${M_C}/devtools/client/debugger/src/components/App.css debugger-App.css

rm *.css.bak
