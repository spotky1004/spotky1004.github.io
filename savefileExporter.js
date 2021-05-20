const toExport = {
    CalculatorEvolution2: "Calculator Evolution",
    IncrementalBlocks: "Incremental Blocks",
    alphabetTree: "Alphabet Tree",
    ordinalDimSave: "Ordinal Dimensions",
    saveFile: "Universe Farm",
    blockHoleShrinker: "Block Hole Shrinker (this game doesn't have export button, but here's your save)",
    countToOverflow: "Count to Overflow",
    GunpowderFactory: "Gunpowder Factory",
    timeLayerSave: "Timfinity"
};

let saveString = "";
const mainDiv = document.getElementById("main");
for (const name in toExport) {
    if (localStorage[name]) {
        let saveData = btoa(localStorage[name]);
        try {
            atob(localStorage[name]);
            saveData = localStorage[name];
        } catch (e) {}

        let namespace = document.createElement("div");
        namespace.innerText = toExport[name];
        mainDiv.append(namespace);
        let exportBox = document.createElement("textarea");
        exportBox.value = saveData;
        mainDiv.append(exportBox);
        
        saveString += `localStorage.${name} = \`${localStorage[name]}\`;`
    }
}

let namespace = document.createElement("div");
namespace.innerHTML = "<span style=\"color: #f00;\">Copy this and paste at the Console(F12) of my new domain (<a href=\"https://spotky1004.com\">https://spotky1004.com</a>) to migrate</span>";
mainDiv.append(namespace);
let exportBox = document.createElement("textarea");
exportBox.value = saveString;
mainDiv.append(exportBox);