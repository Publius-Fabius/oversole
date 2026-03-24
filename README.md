## Oversole: AI Agents for NodeJS!

Oversole is a lightweight, state-driven agentic framework designed to manage hierarchical task execution. It allows agents to collaborate by "calling" one another, executing shell commands, and managing their own context via a specialized caching and logging system.

By treating the agent interaction as a state machine (alternating between PROMPT and EVALUATE), Oversole provides a structured way to handle complex, long-running workflows with a human-in-the-loop or automated backend.

The hierarchical call system acts as a biological "working memory" filter, solving the context window problem by ensuring that the LLM only processes information relevant to its immediate sub-task rather than the entire project at once. In a traditional flat architecture, sending a massive codebase plus a long history of instructions quickly exhausts the token limit, leading to "lost in the middle" phenomena or outright failure. By nesting tasks, Oversole allows a "Manager" agent to hold the high-level strategy while "Worker" agents handle granular details. When a worker is called, it only receives the specific goal and the files it needs to see (via the CACHE command), keeping the prompt lean and focused.

This approach effectively turns a linear context window into a tree structure. Once a sub-agent completes its task and issues a RETURN, the heavy technical details of that sub-task are purged from the active context, replaced only by a concise summary of the result. This "pop" from the stack prevents the context window from being cluttered with expired data. It allows the system to scale in complexity - not by building a bigger window, but by intelligently swapping what is inside that window based on the current depth of the task hierarchy.

### Key Features

-Hierarchical Task Stack: Agents can CALL other agents, creating a sub-task stack, and RETURN results back up the chain.

-Context Management: Explicitly CACHE or DECACHE files to control exactly what information is sent to the model.

-Shell Integration: Use YIELD to execute real-world shell commands (with a built-in safety confirmation).

-Persistent Memory: Maintains a per-agent log.json and history.json to track long-term progress and past interactions.

-Flexible Providers: Currently supports a stdin provider for manual "human-as-the-LLM" testing, with an extensible architecture for API integration.

Agents communicate with the Oversole engine by starting their response with a specific keyword.

## Protocol 

CALL: Spawns a new sub-agent/task.
RETURN: Completes current task and returns data to parent.
YIELD: Executes a shell command.
CACHE: Adds a file's content to the prompt context.
DECACHE: Removes a file from the prompt context.
LOG: Appends a persistent thought or note to the agent's log.

### Directory Structure

Oversole expects a specific directory structure to manage its state:

'''
.
├── oversole.json       # The core state machine and project configuration
├── agents/
│   └── [agent_name]/
│       ├── BIOGRAPHY.md # The "System Prompt" / Persona for the agent
│       ├── history.json # Interaction history
│       └── log.json     # Persistent agent notes
└── ... (work, tmp, and atlas directories)
'''

### Using the stdin Provider

When using the stdin provider, Oversole will output the full INSTRUCTION (including biographies, logs, and cached files) to your terminal.

    Type your response manually.

    To finish a multi-line response, type END on a new line.
