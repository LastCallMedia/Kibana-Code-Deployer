
import * as yargs from 'yargs';
import * as path from 'path'
import chalk from 'chalk'
import {readFileSync, existsSync} from "fs";
import Kibana from "./sources/Kibana";
import Directory from "./sources/Directory";
import SyncManager from './SyncManager'
import {DiffResult, validate} from "./types";

const schema = require('./config.schema');

const decorations = {
    changed: {color: chalk.blue, prefix: '+-'},
    added: {color: chalk.green, prefix: '++'},
    removed: {color: chalk.red, prefix: '--'},
    unchanged: {color: chalk.gray, prefix: '  '}
}

const labelType = (type: string): string => {
    return type.replace('-', ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

const configParser = (configPath: string): Object =>  {
    if(!existsSync(configPath)) {
        return {}
    }
    const config = JSON.parse(readFileSync(configPath, 'UTF-8'))
    // Normalize config.directory by expanding it relative to CWD.
    if(config.directory) {
        const absolute = path.resolve(path.dirname(configPath), config.directory)
        config.directory = path.relative(process.cwd(), absolute)
    }
    return config
}

const stdOpts: yargs.CommandBuilder = {
    c: {
        alias: 'config',
        description: 'Path to a configuration file',
        config: true,
        default: 'kcd.json',
        configParser
    },
    k: {
        alias: 'kibana.url',
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
        describe: 'The directory for exported configuration.',
        type: 'string',
        normalize: true
    },
    t: {
        alias: 'types',
        type: 'array',
        description: 'Types to consider for export',
        default: schema.properties.types.items.enum
    }
}

yargs.options(stdOpts);

yargs.command({
    command: 'import-all',
    describe: 'Import all configuration from a directory to Kibana.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        if(!validate(argv)) return;
        const kibana = new Kibana(argv.kibana)
        const directory = new Directory(argv.directory)
        const manager = new SyncManager(argv.types)

        const items = await manager.sync(directory, kibana)
        console.log(chalk.green(`Successfully imported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'export-all',
    describe: 'Export all configuration from Kibana to a directory.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        if(!validate(argv)) return;
        const kibana = new Kibana(argv.kibana)
        const directory = new Directory(argv.directory)
        const manager = new SyncManager(argv.types)

        const items = await manager.sync(kibana, directory)
        console.log(chalk.green(`Successfully exported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'compare',
    describe: 'Compare Kibana configuration to exported configuration.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        if(!validate(argv)) return;
        const kibana = new Kibana(argv.kibana)
        const directory = new Directory(argv.directory)
        const manager = new SyncManager(argv.types)

        const differences = await manager.diff(directory, kibana)

        let hasChanges = differences.filter(i => i.status !== 'unchanged').length > 0;
        if(hasChanges) {
            console.log('Difference between Kibana and export directory:');
            const format = (item: DiffResult) => {
                const decoration = decorations[item.status]
                return decoration.color(`${decoration.prefix} ${labelType(item.type)}: ${item.title}`)
            }
            differences.forEach(difference => {
                console.log(format(difference))
            })
            // Exit non-0 if we detect changes.
            process.exit(1)
        }
        else {
            console.log('No changes detected');
        }
    }
});

export default yargs
