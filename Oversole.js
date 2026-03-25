const fs = require('node:fs/promises');
const { execSync } = require('child_process');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

class StdinProvider {
    async fetchResponse(instruction, prompt, history) {

        console.log(
`### INSTRUCTION ###
${instruction}
### PROMPT ###
${prompt}
### RESPONSE ###
(type END on a newline to finish the interaction):`);
    
        const rl = readline.createInterface(stdin, stdout);
        
        let text = "";
        for(;;) {
            const line = await rl.question(">");
            if(line.startsWith("END"))
                break;
            text += `${line}\n`;
        }
        rl.close();

        return text.slice(0, text.length - 1);
    }
}

class Oversole {

    constructor(filePath) {
        this.filePath = filePath;
    }

    initProvider() {
        switch(this.model.provider) {
            case "stdin" :
                this.provider = new StdinProvider();
                return;
            default:
                throw new Error(`Unknown provider: ${this.model.provider}`);
        }
    }

    async loadJSON(filePath) {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }

    async saveJSON(object, filePath) {
        const output = JSON.stringify(object, null, 4);
        await fs.writeFile(filePath, output, 'utf8');
    }

    async loadText(filePath) {
        return (await fs.readFile(filePath, 'utf8')).toString();
    }

    async saveText(text, filePath) {
        await fs.writeFile(filePath, text, 'utf8');
    }
    
    getTopTask() {
        const stack = this.model.tasks;
        if(stack.length == 0) 
            throw new Error(`Task stack is empty`);
        return stack[stack.length - 1];
    }

    async prompt() {
        console.log("prompting...");

        const task = this.getTopTask();
        const agentP = path.resolve(this.model.agents, task.agentName);
        const agentHistoryP = path.resolve(agentP, "history.json");
        const agentHistory = await this.loadJSON(agentHistoryP);
        const agentBioP = path.resolve(agentP, "BIOGRAPHY.md");
        const agentBio = await this.loadText(agentBioP);
        const agentLogP = path.resolve(agentP, "log.json");
        const agentLog = await this.loadJSON(agentLogP);
        const protocol = await this.loadText(this.model.protocol);
        const taskGoal = task.goal;

        let cache = "";
        for(let filePath of task.cache) {
            let content;
            try {
                content = await this.loadText(filePath);
            } catch(err) {
                content = err.message;
            }
            cache += 
`<CACHED_FILE path="${filePath}">
${content}
</CACHED_FILE>
`;
        }
            
        let log = "";
        for(let entry of agentLog) 
            log += `${entry}\n`;

        let goals = "";
        for(let n = 0; n < this.model.tasks.length; ++n) {
            const task = this.model.tasks[n];
            goals += 
`<GOAL depth="${n}" agent="${task.agentName}">
${task.goal}
</GOAL>
`;
        }
        const instruction = 
`<PROTOCOL>
${protocol}
</PROTOCOL>
<BIOGRAPHY>
${agentBio}
</BIOGRAPHY>
<PATHS>
atlas=${this.model.atlas}
agents=${this.model.agents}
work=${this.model.work}
tmp=${this.model.tmp}
</PATHS>
${cache}
<LOG>
${log}
</LOG>
<GOAL_STACK ordering="ROOT_TO_LEAF">
${goals}
</GOAL_STACK>
`;
        const prompt = this.model.prompt;
        const result = await this.provider.fetchResponse(
            instruction,
            prompt,
            agentHistory);
        agentHistory.push({ prompt, result });
        await this.saveJSON(agentHistory, agentHistoryP);
        this.model.prompt = "";
        this.model.result = result;
        this.model.mode = "EVALUATE";
        await this.saveJSON(this.model, this.filePath);
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
    async doCall(text) {
        const nlIndex = text.indexOf("\n");
        if(nlIndex == -1) 
            throw new Error("CALL response had no AGENT_NAME");
        const agentName = text.slice(0, nlIndex).trim();
        const goal = text.slice(nlIndex + 1, text.length);
        this.model.tasks.push({ agentName, goal, cache : [] });
        console.log(`CALL\n${agentName}\n${goal}`);
        this.model.prompt = goal;
        this.model.result = "";
        this.model.mode = "PROMPT";
        await this.saveJSON(this.model, this.filePath);
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
    async doReturn(text) {
        this.model.tasks.pop();
        this.model.prompt = text;
        console.log(`RETURN\n${text}`);
        this.model.result = "";
        this.model.mode = "PROMPT";
        await this.saveJSON(this.model, this.filePath);
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
    async doYield(text) {
        const command = text.trim();
        const rl = readline.createInterface(stdin, stdout);
        
        const answer = await rl.question(
`Oversole wants to execute a shell command:
${command}
Choose y/n:`);
        rl.close();
        
        if(answer.trim() != "y") {
            console.log("The shell command was refused.");
            return;
        }
        
        console.log("Executing shell command...");

        try {
            const output = execSync(command, { 
                encoding: 'utf8',
                cwd: process.cwd() }).toString();
            this.model.prompt = 
                output || "(Command executed with no output)";
        } catch (error) {
            this.model.prompt = 
                `ERROR executing command:\n${error.message}`;
        }

        console.log(this.model.prompt);
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
    async doCache(text) {
        const lines = text.trim().split("\n");
        const task = this.getTopTask();
        console.log("CACHE");
        for(const line of lines) {
            console.log(line);
            task.cache.push(path.resolve(line));
        }
        this.model.prompt = "CACHED";
        this.model.result = "";
        this.model.mode = "PROMPT";
        await this.saveJSON(this.model, this.filePath);
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
    async doDecache(text) {
        const lines = text.trim().split("\n");
        const task = this.getTopTask();
        console.log(`DECACHE`);
        for(const line of lines) {
            console.log(line);
            task.cache = task.cache.filter(x => x != path.resolve(line));
        }
        this.model.prompt = "DECACHED";
        this.model.result = "";
        this.model.mode = "PROMPT";
        await this.saveJSON(this.model, this.filePath);
    }

    /**
     * Agent should issue log response like this:
     * 
     *  LOG
     *  ${LOG_CONTENT}
     * 
     * Example: response = "LOG\nThis is my log.\nThis is still my log."
     * 
     * @param {String} text 
     */
    async doLog(text) {
        const agentLogP = path.resolve(
            this.model.agents,
            this.getTopTask().agentName,
            "log.json");
        const log = await this.loadJSON(agentLogP);
        log.push(text);
        await this.saveJSON(log, agentLogP);
        console.log(`LOG\n${text}`);
        this.model.prompt = "LOGGED";
        this.model.result = "";
        this.model.mode = "PROMPT";
        await this.saveJSON(this.model, this.filePath);
    }

    async evaluate() {
        console.log("Evaluating result...");

        const text = this.model.result;
        const nlIndex = text.indexOf("\n");
        if(nlIndex == -1) 
            throw new Error("No response type found");
        const fstLine = text.slice(0, nlIndex);
        const rest = text.slice(nlIndex + 1, text.length);
        if(fstLine.startsWith("CALL")) 
            return await this.doCall(rest);
        else if(fstLine.startsWith("RETURN")) 
            return await this.doReturn(rest);
        else if(fstLine.startsWith("YIELD")) 
            return await this.doYield(rest);
        else if(fstLine.startsWith("CACHE")) 
            return await this.doCache(rest);
        else if(fstLine.startsWith("DECACHE")) 
            return await this.doDecache(rest);
        else if(fstLine.startsWith("LOG"))
            return await this.doLog(rest);
        else
            throw new Error("Response type was invalid");
    }

    async update() {
        console.log("Updating Oversole...");

        this.model = await this.loadJSON(path.resolve(this.filePath));
        this.initProvider();
        switch(this.model.mode) {
            case "EVALUATE": 
                return await this.evaluate();
            case "PROMPT": 
                return await this.prompt();
            default: 
                throw new Error(
                    `Invalid state machine mode: ${task.model.mode}`);
        }
    }
};

module.exports = Oversole;
