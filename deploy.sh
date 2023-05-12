#!/bin/bash

# Pull changes
git pull

# Find the process ID (PID) using lsof
pid=$(lsof -t -i :3000)

if [[ -n $pid ]]; then
    # Process found, kill it using kill -9
    echo "Killing process $pid running on port 3000..."
    kill -9 $pid
    echo "Process killed."
else
    echo "No process found running on port 3000."
fi

# Start server
bun run index.ts &
