#!/usr/bin/env expect

# codebuff.sh - A script to run codebuff with instructions and context using expect
# Usage: ./codebuff.sh <repo_path> <instructions> <context>

# Check if all arguments are provided
if {$argc < 3} {
    puts "Usage: $argv0 <repo_path> <instructions> <context>"
    exit 1
}

# Get arguments
set repo_path [lindex $argv 0]
set instructions [lindex $argv 1]
set context [lindex $argv 2]

# Clean up the inputs - replace newlines with spaces
regsub -all {\n} $instructions " " instructions
regsub -all {\r} $instructions " " instructions
regsub -all {\n} $context " " context
regsub -all {\r} $context " " context

set folder_name [file tail $repo_path]
set timeout 300

# Change to the repository directory
cd $repo_path

# Start capturing output
log_file -noappend /tmp/codebuff_result.txt

# Start the codebuff process
puts "Starting codebuff in $repo_path..."
spawn yarn codebuff

# Set up the interaction
expect {
    -re "$folder_name >" {
        puts "Sending instructions..."
        send "I need help fixing an issue: $instructions. Here's some log context: $context\r"
        exp_continue
    }
    "used for this request" {
        puts "Completion message detected"
        # Continue waiting for the next prompt
        expect -re "$folder_name >" {
            puts "Task completed, exiting..."
            send "exit\r"
        }
    }
    timeout {
        puts "ERROR: Process timed out after $timeout seconds"
        exit 1
    }
}

# Wait for the process to complete
expect eof

# Output the result in a format that can be easily parsed
puts "RESULT_START"
exec cat /tmp/codebuff_result.txt
puts "RESULT_END"

# Clean up
exec rm -f /tmp/codebuff_result.txt

exit 0
