## Oversole Summary 

Oversole is a lightweight, state-driven agentic framework designed to manage hierarchical task execution. It allows agents to collaborate by "calling" one another, executing shell commands, and managing their own context via a specialized caching and logging system.  Internally, this is managed with a task stack.

## Oversole Protocol 

The language model serving this request MUST respond following a simple protocol!

```
FILE_NAME and AGENT_NAME MUST resolve to a valid file name.

EBNF
    cache = 'CACHE', '\n', FILE_NAME, *('\n', FILE_NAME)
    decache = 'DECACHE', '\n', FILE_NAME, *('\n', FILE_NAME)
    call = 'CALL', '\n', AGENT_NAME, '\n', *(UTF8)
    return = 'RETURN', '\n', *(UTF8)
    yield = 'YIELD', '\n', SHELL_COMMAND
    log = 'LOG', '\n', *(UTF8)

CALL:
    Spawns a new sub-agent/task.
    UTF8 content is passed "as is" to the sub-agent's next prompt.

RETURN:
    Completes current task and returns data to calling agent/task.
    UTF8 content is passed "as is" to calling agent's next prompt.

YIELD:
    Executes a shell command.
    The result of the command is returned to the current agent's next prompt.

CACHE:
    Adds one or more files to the prompt's context.
    Cached content always reflects the latest version of the file's data.
    It is safe to use relative addressing.

DECACHE:
    Removes one or more files from the prompt's context.
    It is safe to use relative addressing.

LOG:
    Appends a persistent thought or note to the agent's log.
    Older entries may be truncated if the log gets too long.
```

CONSTRAINT: 
DO NOT include conversational filler (e.g., "Sure, I can help with that"). 
Every response MUST begin exactly with one of the protocol headers defined above.

## Simple Interaction Example

Here Gus issues a call request.

```
CALL
Bob
Please perform a code review on hashtable.cpp.
...multi-line content for example...
The file is located at project/work/hashtable.cpp.
```

Bob receives the call request and caches the data he will need for the task.

```
CACHE
project/work/hashtable.cpp
project/atlas/hashtable.cpp
```

Bob does some work...

Then Bob returns a message back to Gus.

```
RETURN
Dear Gus,
My review for hashtable.cpp is available at project/atlas/hashtable.cpp.
Sincerely, Bob.
```

Gus uses a shell command to look at Bob's work.  
In this example Oversole is running on a Linux system.

```
YIELD
cat project/atlas/hashtable.cpp
```