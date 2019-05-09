
import * as yargs from 'yargs';
import {Config, importAll, exportAll, listChanges} from './lib'

type CommandArguments = yargs.Arguments & Config

// Types of things we'll consider exporting:
const defaultTypes = [
    'index-pattern',
    'visualization',
    'dashboard'
];

const stdOpts: yargs.CommandBuilder = {
    k: {
        alias: 'kibana.url',
        demandOption: true,
        describe: 'The URL to the Kibana instance',
        type: 'string'
    },
    d: {
        alias: 'directory',
        demandOption: true,
        describe: 'The directory for exported configuration.',
        type: 'string',
        normalize: true
    },
    t: {
        alias: 'types',
        description: 'Types to consider for export',
        demandOption: true,
        default: defaultTypes
    }
}

yargs.command({
    command: 'import-all',
    describe: 'Import all configuration from a directory to Kibana.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        await importAll(argv)
    }
});
yargs.command({
    command: 'export-all',
    describe: 'Export all configuration from Kibana to a directory.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        await exportAll(argv)
    },
});
yargs.command({
    command: 'compare',
    describe: 'Compare Kibana configuration to exported configuration.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        const changes = await listChanges(argv);
        changes.added.forEach(c => console.log(`++ ${c}`));
        changes.changed.forEach(c => console.log(`+- ${c}`))
        changes.removed.forEach(c => console.log(`-- ${c}`));
    }
});
yargs.demandCommand().argv;
