M_C=$1

if [ "x${M_C}" = "x" ]; then
    echo "Usage import_js.sh PATH_TO_MOZILLA_CENTRAL" > /dev/stderr
    exit 1
fi


cp ${M_C}/devtools/client/debugger/dist/pretty-print-worker.js pretty-print-worker.js
