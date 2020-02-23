M_C=$1

if [ "x${M_C}" = "x" ]; then
    echo "Usage import_css.sh PATH_TO_MOZILLA_CENTRAL" > /dev/stderr
    exit 1
fi

cp ${M_C}/devtools/client/themes/common.css devtools-common.css
sed -i .bak -e 's|resource://devtools/client/themes/|devtools-|' devtools-common.css
rm devtools-common.css.bak

cp ${M_C}/devtools/client/themes/splitters.css devtools-splitters.css
cp ${M_C}/devtools/client/themes/variables.css devtools-variables.css
cp ${M_C}/devtools/client/themes/toolbars.css devtools-toolbars.css

cp ${M_C}/devtools/client/themes/tooltips.css devtools-tooltips.css

cp ${M_C}/devtools/client/debugger/src/components/variables.css debugger-variables.css
cp ${M_C}/devtools/client/debugger/src/components/Editor/Tabs.css debugger-Tabs.css
cp ${M_C}/devtools/client/debugger/src/components/App.css debugger-App.css

