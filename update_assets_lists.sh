#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/client-android/src/main/assets/defaults"
touch .nomedia
find -L . ! -path . -type d | sed -E "s|^\./||" > ../index.txt
find -L . ! -path . | sed -E "s|^\./||" > ../filelist.txt
echo "Regenerated index.txt and filelist.txt successfully!"
