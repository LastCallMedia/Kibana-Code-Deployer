
import * as yargs from 'yargs';
import * as path from 'path'
import {Config, importAll, exportAll, listChanges, StatusItem} from './lib'
import chalk from 'chalk'

type CommandArguments = yargs.Arguments & Config

// Types of things we'll consider exporting:
export const ExportableTypeMap = {
    visualization: 'Visualization',
    dashboard: 'Dashboard',
    'index-pattern': 'Index Pattern',
    search: 'Saved Search',
    'timelion-sheet': 'Timelion Sheet',
}

const decorations = {
    changed: {color: chalk.blue, prefix: '+-'},
    added: {color: chalk.green, prefix: '++'},
    removed: {color: chalk.red, prefix: '--'},
    unchanged: {color: chalk.gray, prefix: '  '}
}

const stdOpts: yargs.CommandBuilder = {
    c: {
        alias: 'config',
        description: 'Path to a configuration file',
        config: true,
        default: 'kcd.json'
    },
    k: {
        alias: 'kibana.url',
        demandOption: true,
        describe: 'The URL to the Kibana instance',
        type: 'string'
    },
    h: {
        alias: 'kibana.headers.host',
        describe: 'Host header override when making requests to Kibana',
        type: 'string'
    },
    d: {
        alias: 'directory',
        demandOption: true,
        describe: 'The directory for exported configuration.',
        type: 'string'
    },
    t: {
        alias: 'types',
        description: 'Types to consider for export',
        demandOption: true,
        default: Object.keys(ExportableTypeMap)
    }
}

function extractConfig(argv: any): Config {
    if(typeof argv.kibana !== 'object') {
        throw new Error('kibana must be an object');
    }
    if(!argv.kibana.hasOwnProperty('url') || typeof argv.kibana.url !== 'string') {
        throw new Error('kibana.url must be a string.');
    }
    if(!argv.hasOwnProperty('directory') || typeof argv.directory !== 'string') {
        throw new Error('directory must be a string.');
    }
    if(!argv.hasOwnProperty('types') || !Array.isArray(argv.types)) {
        throw new Error('types must be an array of strings.');
    }
    if(argv.hasOwnProperty('config')) {
        // Resolve sync directory relative to config file.
        argv.directory = path.resolve(path.dirname(argv.config), path.normalize(argv.directory))
    }
    else {
        argv.directory = path.normalize(argv.directory)
    }
    return {
        kibana: {
            url: argv.kibana.url,
            headers: argv.kibana.headers || {}
        },
        directory: argv.directory,
        types: argv.types
    }
}

yargs.command({
    command: 'import-all',
    describe: 'Import all configuration from a directory to Kibana.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        const items = await importAll(extractConfig(argv))
        console.log(chalk.green(`Successfully imported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'export-all',
    describe: 'Export all configuration from Kibana to a directory.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        const items = await exportAll(extractConfig(argv))
        console.log(chalk.green(`Successfully exported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'compare',
    describe: 'Compare Kibana configuration to exported configuration.',
    builder: stdOpts,
    handler: async (argv: CommandArguments) => {
        const items = await listChanges(extractConfig(argv));
        let hasChanges = items.filter(i => i.status !== 'unchanged').length > 0;
        if(hasChanges) {
            console.log('Difference between Kibana and export directory:');
            const format = (item: StatusItem) => {
                const decoration = decorations[item.status]
                return decoration.color(`${decoration.prefix} ${ExportableTypeMap[item.type]}: ${item.title}`)
            }
            items.forEach(item => {
                console.log(format(item))
            })
            // Exit non-0 if we detect changes.
            process.exit(1)
        }
        else {
            console.log('No changes detected');
        }
    }
});
yargs.demandCommand().argv;
