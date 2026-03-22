
const { argv } = require('node:process');
const fs = require('node:fs');

class ontology {
    constructor() {

    }
    doRemove(n) {

    }

    doInsert(n) {

    }

    doPrune(n) {

    }

    doReplace(n) {

    }

    doShow(n) {

    }

    doRegex(n) {

    }

    doInspect(n) {

    }
};

function doAdd(n) {
    fs.writeFile()
}



function main() {
    if(!argv[2]) {
        console.log("No command specified.  Use --help.");
        return;
    } else if(argv[2] == "--help") {
        console.log(
`# ont help
--help - get help
--base [DIRECTORY] - root ontology directory
--mkdir [DIRECTORY] - create a new ontology directory
--rmdir [DIRECTORY] - remove an ontology directory
--add [FILE] - add a new ontology file
--remove [FILE] - remove an ontology  file
--insert [FILE] [LINE] [TEXT] - Insert text before line in an ontology
--prune [FILE] [LINE] - Prune a line in an ontology
--replace [FILE] [LINE] [TEXT] - Replace a line in an ontology
--show [DIRECTORY] [DEPTH] - show ontologies with recursion
--regex [DIRECTORY/FILE] [REGEXP] [DEPTH] - Perform regex search
--inspect [FILE] - Inspect contents of specific ontology
`);
        return;
    } 
    
    var baseDirName = "project/ontology";

    for(let n = 2; n < argv.length;) {
        switch(argv[n]) {
            case "--add": 
                n += doAdd(++n);
                break;
            case "--remove": 
                n += doRemove(++n);
                break;
            case "--insert": 
                n += doInsert(++n);
                break;
            case "--prune": 
                n += doPrune(++n);
                break;
            case "--replace": 
                n += doReplace(++n);
                break;
            case "--show": 
                n += doShow(++n);
                break;
            case "--regex":
                n += doRegex(++n);
                break;
            case "--inspect": 
                n += doInspect(++n);
                break;
            default: 
                throw new Error(`Bad argument:${argv[n]}`);
        }
    }
}

main();