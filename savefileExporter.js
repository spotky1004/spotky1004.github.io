const toExport = {
    CalculatorEvolution2: "Calculator Evolution",
    IncrementalBlocks: "Incremental Blocks",
    alphabetTree: "Alphabet Tree",
    ordinalDimSave: "Ordinal Dimensions",
    saveFile: "Universe Farm",
    blockHoleShrinker: "Block Hole Shrinker (this game doesn't have export button, but here's your save)",

};

const mainDiv = document.getElementById("main");
for (const name in toExport) {
    if (localStorage[name]) {
        let namespace = document.createElement("div");
        namespace.innerText = toExport[name];
        mainDiv.append(namespace);
        let exportBox = document.createElement("textarea");
        exportBox.value = btoa(localStorage[name]);
        mainDiv.append(exportBox);
    }
}