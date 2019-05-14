

import * as yargs from 'yargs';
import * as path from 'path'
import {importAll, exportAll, listChanges, StatusItem} from './lib'
import {Configuration} from './config'
import chalk from 'chalk'
import {readFileSync, existsSync} from "fs";
import * as Ajv from 'ajv'
import {cloneDeep} from 'lodash'

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

function configExtractor(argv: any): Configuration {
    const config = cloneDeep(argv)
    const ajv = new Ajv({removeAdditional: 'all'});
    const validator = ajv.compile(schema)

    if(validator(config)) {
        return config
    }
    const messages = validator.errors.map(err => `  * ${err.message}`).join('\n')
    throw new Error(`Configuration validation failed with the following errors:\n${messages}`)
}

yargs.command({
    command: 'import-all',
    describe: 'Import all configuration from a directory to Kibana.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        const items = await importAll(configExtractor(argv))
        console.log(chalk.green(`Successfully imported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'export-all',
    describe: 'Export all configuration from Kibana to a directory.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        const items = await exportAll(configExtractor(argv))
        console.log(chalk.green(`Successfully exported ${chalk.bold(items.toString())} objects`))
    }
});
yargs.command({
    command: 'compare',
    describe: 'Compare Kibana configuration to exported configuration.',
    // builder: stdOpts,
    handler: async (argv: yargs.Arguments) => {
        const items = await listChanges(configExtractor(argv));
        let hasChanges = items.filter(i => i.status !== 'unchanged').length > 0;
        if(hasChanges) {
            console.log('Difference between Kibana and export directory:');
            const format = (item: StatusItem) => {
                const decoration = decorations[item.status]
                return decoration.color(`${decoration.prefix} ${labelType(item.type)}: ${item.title}`)
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

export default yargs
