
// import * as lib from '../src/lib'
import app from '../src/cli'
import * as lib from '../src/lib';
import * as path from 'path'

jest.mock('../src/lib');


// Override the failure handler so it doesn't exit.
app.fail((msg, err) => {
    if(err) throw err
    // Upcast msg to an error.
    throw new Error(msg)
})

describe('CLI Option Parsing', function() {
    const config = path.resolve(__dirname, 'kcd.json')

    it('Provides default values for configuration', function() {
        const parsed = app.parse('');
        expect(parsed).toMatchObject({
            config: 'kcd.json',
        })
        expect(parsed).toHaveProperty('types')
    });
    it('Sets configuration values based on config', function() {
        const parsed = app.parse(`--config ${config}`)
        expect(parsed).toMatchObject({
            kibana: {
                url: 'foo',
                headers: {
                    host: 'bar'
                }
            }
        })
    });
    it('Sets configuration values based on flags', function() {
        const parsed = app.parse('--types visualization dashboard --kibana.url foo --kibana.headers.host bar');
        expect(parsed).toMatchObject({
            kibana: {url: 'foo', headers: {host: 'bar'}},
            config: 'kcd.json',
            types: ['visualization', 'dashboard'],
        })
    })
    it('Overrides configuration values based on flags', function() {
        const parsed = app.parse(`--config ${config} --types visualization dashboard --kibana.url baz --kibana.headers.host bazbar`)
        expect(parsed).toMatchObject({
            kibana: {
                url: 'baz',
                headers: {
                    host: 'bazbar'
                }
            }
        })
    })
    it('Normalizes directory set on the command line relative to CWD', function() {
        const parsed = app.parse(`--directory ./foo`)
        expect(parsed).toMatchObject({
            directory: 'foo'
        })
    })
    it('Normalizes directory set in config relative to the config file', function() {
        const parsed = app.parse(`--config ${config}`)
        expect(parsed).toMatchObject({
            directory: path.relative(process.cwd(), path.resolve(__dirname, 'foo'))
        })
    })
})