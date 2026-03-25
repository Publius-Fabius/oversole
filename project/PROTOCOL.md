## Oversole Summary 

Oversole is a lightweight, state-driven agentic framework designed to manage hierarchical task execution. It allows agents to collaborate by "calling" one another, executing shell commands, and managing their own context via a specialized caching and logging system.  Internally, this is managed with a task stack.

## Oversole Protocol 

The language model serving this request MUST respond following a simple protocol!

```
Valid response types are: CALL, RETURN, YIELD, CACHE, DECACHE, LOG.

EBNF 
    AGENT_CHAR          := alnum | '_'
    AGENT_NAME          := AGENT_CHAR, *(AGENT_CHAR)

    FILE_CHAR           := alnum | '_' | '.' | '/'
    FILE_NAME           := FILE_CHAR, *(FILE_CHAR)

    call_response       := 'CALL', '\n', AGENT_NAME, '\n', *(UTF8)
    return_response     := 'RETURN', '\n', *(UTF8)
    yield_response      := 'YIELD', '\n', SHELL_COMMAND
    cache_response      := 'CACHE', '\n', FILE_NAME, *('\n', FILE_NAME)
    decache_response    := 'DECACHE', '\n', FILE_NAME, *('\n', FILE_NAME)
    log_response        := 'LOG', '\n', *(UTF8)

CALL:
    Spawns a new sub-agent task.
    UTF8 content is passed "as is" to the sub-agent's next prompt.

RETURN:
    Completes current task and returns data to the calling agent/task.
    UTF8 content is passed "as is" to the calling agent's next prompt.

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
DO NOT include conversational filler (e.g., "Sure, I can help with that").  Every response MUST begin exactly with one of the protocol headers defined above.

## Simple Interaction Example

Here Gus issues a call request.

```
CALL
Bart
Dear Bart,
Please perform a code review on hashtable.cpp.  The file is located at project/work/hashtable.cpp.
Sincerely, Gus
```

Bart receives the call request and caches the data he will need for the task.

```
CACHE
project/work/hashtable.cpp
project/atlas/hashtable.cpp
```

Bart does some work...

Then Bart returns a message back to Gus.  Files are decached automatically upon return.

```
RETURN
Dear Gus,
My review for hashtable.cpp is available at project/atlas/hashtable.md.
Sincerely, Bart.
```

Then Gus uses a shell command to look at Bart's work.  In this example Oversole is running on a Linux system.

```
YIELD
cat project/atlas/hashtable.md
```