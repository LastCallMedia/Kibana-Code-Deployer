
import * as yargs from 'yargs';
import * as path from 'path'
import chalk from 'chalk'
import {readFileSync, existsSync} from "fs";
import Kibana from "./sources/Kibana";
import Directory from "./sources/Directory";
import SyncManager from './SyncManager'
import {DiffResult, Exportable, validate} from "./types";

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
        default: ["visualization", "dashboard", "index-pattern", "search", "timelion-sheet"]
    }
}

yargs.options(stdOpts);

yargs.command({
    command: 'import-all',
    describe: 'Import all configuration from a directory to Kibana.',
    builder: {
        'r': {
            alias: 'cleanup',
            describe: 'Cleanup objects that do not exist in the export directory?',
            type: 'boolean',
            default: false
        }
    },
    handler: async (argv: yargs.Arguments & {cleanup: boolean}) => {
        if(!validate(argv)) return;
        const kibana = new Kibana(argv.kibana)
        const directory = new Directory(argv.directory)
        const manager = new SyncManager(argv.types)

        const items = await manager.sync(directory, kibana, argv.cleanup)
        if(argv.cleanup) {
            console.log(chalk.green(`Import complete. ${chalk.bold(items.changed.length.toString())} changed, ${chalk.bold(items.added.length.toString())} added, and ${chalk.bold(items.removed.length.toString())} removed.`))
        }
        else {
            console.log(chalk.green(`Import complete. ${chalk.bold(items.changed.length.toString())} changed, ${chalk.bold(items.added.length.toString())} added`))
        }
    }
});
yargs.command({
    command: 'export-all',
    describe: 'Export all configuration from Kibana to a directory.',
    handler: async (argv: yargs.Arguments) => {
        if(!validate(argv)) return;
        const kibana = new Kibana(argv.kibana)
        const directory = new Directory(argv.directory)
        const manager = new SyncManager(argv.types)

        const items = await manager.sync(kibana, directory, true)
        console.log(chalk.green(`Export complete. ${chalk.bold(items.changed.length.toString())} changed, ${chalk.bold(items.added.length.toString())} added, and ${chalk.bold(items.removed.length.toString())} removed.`))
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

        let changes = (differences.changed.length + differences.added.length + differences.removed.length)

        if(changes > 0) {
            console.log('Difference between Kibana and export directory:');
            const format = (item: Exportable, status) => {
                const decoration = decorations[status]
                const title = item.attributes.title || item.id
                return decoration.color(`${decoration.prefix} ${labelType(item.type)}: ${title}`)
            }
            differences.unchanged.forEach(diff => console.log(format(diff, 'unchanged')))
            differences.changed.forEach(diff => console.log(format(diff, 'changed')))
            differences.added.forEach(diff => console.log(format(diff, 'added')))
            differences.removed.forEach(diff => console.log(format(diff, 'removed')))

            // Exit non-0 if we detect changes.
            process.exit(1)
        }
        else {
            console.log('No changes detected');
        }
    }
});

export default yargs
