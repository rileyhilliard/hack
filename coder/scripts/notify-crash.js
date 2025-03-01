#!/usr/bin/env node

import chalk from 'chalk';

console.log(chalk.red.bold('\n🚨 Server crashed! Waiting for changes to restart...\n'));

// You can add more notification logic here if needed
// For example, desktop notifications, etc.

process.exit(0);
