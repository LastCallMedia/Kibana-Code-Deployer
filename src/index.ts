#!/usr/bin/env node

import app from './cli'

app.strict();
app.demandCommand();
app.parse(process.argv.slice(2));
