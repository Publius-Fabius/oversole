const fs = require('node:fs');
const { execSync } = require('child_process');
const path = require('node:path');

class StdinProvider {
    fetchResponse(instruction, prompt, history) {
        console.log(
`INSTRUCTION:
${instruction}
PROMPT:
${prompt}
RESPONSE:`);
        return fs.readFileSync(Response.stdin.fd);
    }
}

class Oversole {

    constructor(filePath) {
        this.filePath = filePath;
        this.model = this.loadJSON(path.resolve(filePath));
        this.initProvider();
    }

    initProvider() {
        switch(this.model.provider) {
            case "stdin" :
                this.provider = new StdinProvider();
                return;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    loadJSON(filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    saveJSON(object, filePath) {
        const output = JSON.stringify(object, null, 4);
        fs.writeFileSync(filePath, output, 'utf8');
    }

    loadText(filePath) {
        return fs.readFileSync(filePath, 'utf8');
    }

    saveText(text, filePath) {
        fs.writeFileSync(filePath, text, 'utf8');
    }
    
    getTopTask() {
        const stack = this.model.stack;
        if(stack.length == 0) {
            throw new Error(`Task stack is empty`);
        }
        return stack[stack.length - 1];
    }

    prompt() {
        const task = getTopTask();
        const agentP = path.resolve(this.model.agents, task.agentName);
        const agentHistoryP = path.resolve(agentP, "history.json");
        const agentHistory = this.loadJSON(agentHistoryP);
        const agentInstructionP = path.resolve(agentP, "INSTRUCTION.md");
        const agentInstruction = this.loadText(agentInstructionP);
        const program = this.loadText(this.model.program);
        const taskGoal = task.goal;

        let cache = "";
        for(let filePath of task.cache) {
            cache += 
`<TEXT file="${filePath}">
${this.loadText(filePath)}
</TEXT>`;
        }

        const instruction = 
`<INSTRUCTION>
${agentInstruction}
</INSTRUCTION>
<PROGRAM>
${program}
</PROGRAM>
<PATHS>
projectRoot=${this.filePath}
ontology=${this.model.ontology}
agents=${this.model.agents}
work=${this.model.work}
</PATHS>
<CACHE>
${cache}
</CACHE>
<GOAL>
${taskGoal}
</GOAL>
`;

        const prompt = this.model.prompt;
        const result = this.provider.fetchResponse(
            instruction,
            prompt,
            agentHistory);

        agentHistory.push({ prompt, result });
        this.saveJSON(agentHistory, agentHistoryP);

        this.model.prompt = "";
        this.model.result = result;
        this.model.mode = "EVALUATE";
        this.saveJSON(this.model, this.filePath);
    }

    /**
     * Agent should issue call response like this:
     * 
     *  CALL
     *  ${AGENT_NAME}
     *  ${GOAL_CONTENT} 
     * 
     * Example: response = "CALL\nFred\nMake a sandwich."
     * 
     * GOAL_CONTENT can contain any valid UTF8 including new line characters.
     * 
     * @param {String} text 
     */
    doCall(text) {
        const nlIndex = text.indexOf("\n");
        if(!nlIndex) {
            throw new Error("CALL response had no AGENT_NAME");
        }
        const agentName = text.slice(0, nlIndex).trim();
        const goal = text.slice(nlIndex, text.length);
        this.model.tasks.push({ agentName, goal, cache : [] });
        this.model.prompt = goal;
        this.model.result = "";
        this.model.mode = "PROMPT";
        this.saveJSON(this.model, this.filePath);
    }
    
    /**
     * Agent should issue return response like this:
     * 
     *  RETURN
     *  ${RESPONSE_CONTENT}
     * 
     * Example: response = "RETURN\nThere was no bread."
     * 
     * RESPONSE_CONTENT can contain any valid UTF8 including new lines.
     * 
     * @param {String} text 
     */
    doReturn(text) {
        this.model.tasks.pop();
        this.model.prompt = text;
        this.model.result = "";
        this.model.mode = "PROMPT";
        this.saveJSON(this.model, this.filePath);
    }

    /**
     * Agent should issue yield response like this:
     * 
     *  YIELD
     *  ${SHELL_EXPRESSION}
     *  
     * Example: response = "YIELD\nls -al"
     * 
     * @param {String} text 
     */
    doYield(text) {
        const command = text.trim();
        try {
            const output = execSync(command, { 
                encoding: 'utf8',
                cwd: process.cwd() });
            this.model.prompt = 
                output.toString() || "(Command executed with no output)";
        } catch (error) {
            this.model.prompt = `ERROR executing command:\n${error.message}`;
        }
        this.model.result = "";
        this.model.mode = "PROMPT";
        this.saveJSON(this.model, this.filePath);
    }

    /**
     * Agent should issue cache response like this:
     * 
     *  CACHE
     *  ${FILE}
     *  
     * Multiple files can be cached at once, each separated by a new line.
     * 
     * Example: response = "CACHE\nproject/RULES.md\nproject/run.js"
     * 
     * @param {String} text 
     */
    doCache(text) {
        const lines = text.trim().split("\n");
        const task = this.getTopTask();
        for(line of lines) {
            task.cache.push(line);
        }
        this.model.prompt = "CACHED";
        this.model.result = "";
        this.model.mode = "PROMPT";
        this.saveJSON(this.model, this.filePath);
    }

    /**
     * Agent should issue decache response like this:
     * 
     *  CACHE
     *  ${FILE}
     *  
     * Multiple files can be decached at once, each separated by a new line.
     * 
     * Example: response = "CACHE\nproject/RULES.md\nproject/run.js"
     * 
     * @param {String} text 
     */
    doDecache(text) {
        const lines = text.trim().split("\n");
        const task = this.getTopTask();
        for(line of lines) {
            task.cache = task.cache.filter(x => x != line);
        }
        this.model.prompt = "DECACHED";
        this.model.result = "";
        this.model.mode = "PROMPT";
        this.saveJSON(this.model, this.filePath);
    }

    evaluate() {
        const text = this.model.result;

        const nlIndex = text.indexOf("\n");
        if(!nlIndex) {
            throw new Error("Response didn't contain a type line");
        }
        const fstLine = text.slice(0, nlIndex);
        const rest = text.slice(nlIndex, text.length);

        if(fstLine.startsWith("CALL")) {
            return this.doCall(rest);
        } else if(fstLine.startsWith("RETURN")) {
            return this.doReturn(rest);
        } else if(fstLine.startsWith("YIELD")) {
            return this.doYield(rest);
        } else if(fstLine.startsWith("CACHE")) {
            return this.doCache(rest);
        } else if(fstLine.startsWith("DECACHE")) {
            return this.doDecache(rest);
        } else {
            throw new Error("Response type was invalid");
        }
    }

    async update() {
        switch(this.model.mode) {
            case "EVALUATE": 
                return this.evaluate();
            case "PROMPT": 
                return this.prompt();
            default: 
                throw new Error("Bad state machine mode");
        }
    }
};

module.exports = Oversole;