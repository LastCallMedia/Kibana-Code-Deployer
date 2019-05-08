
const yargs = require('yargs');
const lib = require('./lib');

const stdBuilder = (yargs) => {
    yargs.option('k', {
        alias: 'kibana',
        demandOption: true,
        describe: 'The URL to the Kibana instance',
        type: 'string'
    })
    yargs.option('d', {
        'alias': 'directory',
        demandOption: true,
        describe: 'The directory for exported configuration.',
        type: 'string',
    })
};

yargs.command({
    command: 'import-all',
    desc: 'Import all configuration from a directory to Kibana.',
    builder: stdBuilder,
    handler: async (argv) => {
        await lib.importAll()
    }
});
yargs.command({
    command: 'export-all',
    desc: 'Export all configuration from Kibana to a directory.',
    builder: stdBuilder,
    handler: async (argv) => {
        await lib.exportAll()
    },
});
yargs.command({
    command: 'compare',
    desc: 'Compare Kibana configuration to exported configuration.',
    builder: stdBuilder,
    handler: async (argv) => {
        const changes = await lib.listChanges(argv.k, argv.d);
        changes.added.forEach(c => console.log(`++ ${c}`));
        changes.changed.forEach(c => console.log(`+- ${c}`))
        changes.removed.forEach(c => console.log(`-- ${c}`));
    }
});
yargs.demandCommand().argv;
