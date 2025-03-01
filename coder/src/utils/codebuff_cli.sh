#!/bin/bash

# codebuff_cli.sh - A script to run codebuff with instructions and context
# Usage: ./codebuff_cli.sh <repo_path> <instructions> <context>

# Check if all arguments are provided
if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <repo_path> <instructions> <context>"
    exit 1
fi

REPO_PATH="$1"
INSTRUCTIONS="$2"
CONTEXT="$3"
FOLDER_NAME=$(basename "$REPO_PATH")
TIMEOUT=300  # 5 minutes timeout

# Change to the repository directory
cd "$REPO_PATH" || { echo "Failed to change to directory $REPO_PATH"; exit 1; }

# Start codebuff process
echo "Starting codebuff in $REPO_PATH..."

# Create a named pipe for communication
PIPE_DIR=$(mktemp -d)
PIPE_IN="$PIPE_DIR/in"
PIPE_OUT="$PIPE_DIR/out"
RESULT_FILE="$PIPE_DIR/result"

# Clean up on exit
trap 'rm -rf $PIPE_DIR' EXIT

# Create the pipes
mkfifo "$PIPE_IN"
mkfifo "$PIPE_OUT"
touch "$RESULT_FILE"

# Start codebuff in the background, connecting to our pipes
yarn codebuff < "$PIPE_IN" > "$PIPE_OUT" 2>&1 &
CODEBUFF_PID=$!

# Set a timeout for the entire process
(
    sleep $TIMEOUT
    echo "ERROR: Process timed out after $TIMEOUT seconds" >> "$RESULT_FILE"
    kill -9 $CODEBUFF_PID 2>/dev/null
) &
TIMEOUT_PID=$!

# Process the output and send input when needed
{
    INSTRUCTIONS_SENT=false
    COMPLETED=false

    # Read from the output pipe
    while IFS= read -r line; do
        echo "$line"
        echo "$line" >> "$RESULT_FILE"

        # When we see the prompt for the first time, send instructions
        if [[ "$line" == *"$FOLDER_NAME >"* ]] && [ "$INSTRUCTIONS_SENT" = false ]; then
            echo "Sending instructions..."
            echo "I need help fixing an issue: $INSTRUCTIONS. Here's some log context: $CONTEXT" > "$PIPE_IN"
            INSTRUCTIONS_SENT=true
        fi

        # Check for completion message
        if [[ "$line" == *"used for this request"* ]]; then
            COMPLETED=true
        fi

        # When completed and we see the prompt again, exit
        if [ "$COMPLETED" = true ] && [[ "$line" == *"$FOLDER_NAME >"* ]]; then
            echo "Task completed, exiting..."
            echo "exit" > "$PIPE_IN"
            break
        fi
    done < "$PIPE_OUT"

    # Kill the timeout process
    kill $TIMEOUT_PID 2>/dev/null

    # Wait for codebuff to exit
    wait $CODEBUFF_PID 2>/dev/null

    # Output the result in a format that can be easily parsed
    echo "RESULT_START"
    cat "$RESULT_FILE"
    echo "RESULT_END"
}

exit 0
