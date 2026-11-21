#!/bin/bash
# Compila o código Java REAL da app (repositórios, rede, modelos) com uma variante do
# FirebaseConfig apontada para o emulador e executa o fluxo completo na JVM.
# Requisitos: JDK 8+, um android.jar (ex.: Robolectric android-all 13) em ANDROID_JAR,
# e R.java gerado pelo aapt em GEN_DIR (ver documentation/TESTING.md).
set -e
cd "$(dirname "$0")"
APP=../../../android-app/app/src/main/java
OUT=$(mktemp -d)
mkdir -p "$OUT/src/com/ketshop/network" "$OUT/src/test"
cp FirebaseConfig.emulator.java "$OUT/src/com/ketshop/network/FirebaseConfig.java"
cp FlowTest.java "$OUT/src/test/"
find "$APP" -name '*.java' ! -path '*/network/FirebaseConfig.java' > "$OUT/sources.txt"
find "$OUT/src" "$GEN_DIR" -name '*.java' >> "$OUT/sources.txt"
javac -source 8 -target 8 -encoding UTF-8 -nowarn -classpath "$ANDROID_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
bash seed-emulator.sh
java -cp "$OUT/classes:$ANDROID_JAR" test.FlowTest
